import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppError, forbidden } from '../../../common/http/app.error.js';
import { NET } from '../../../common/catalog.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { selectedCats } from '../../auth/domain/signup.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { EnvService } from '../../../config/env.service.js';
import {
  PHOTO,
  type PhotoPort,
} from '../../../infrastructure/photo/photo.port.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { AuditService } from '../../audit/service/audit.service.js';
import {
  derivedOf,
  isListed,
  pullupScore,
  totalFollowers,
} from '../domain/metrics.js';
import { toRecord, type InfluencerRow } from '../domain/mapper.js';
import { pageOf, presentInfluencer } from '../domain/present.js';
import {
  canSeeProfile,
  carouselOf,
  filterListed,
  listedOf,
} from '../domain/query.js';
import { utcDay, viewsSeries } from '../domain/views.js';
import { assertVitrine, mergeRates } from '../domain/vitrine.js';
import type { RateJson } from '../domain/types.js';
import type {
  ContactRequestDto,
  ListQueryDto,
  PhotoDto,
  VitrineDto,
} from '../dto/influencers.dto.js';

const FAVORITE_FORBIDDEN =
  "Connectez-vous en tant qu'annonceur pour créer votre sélection.";

@Injectable()
export class InfluencersService {
  constructor(
    private readonly db: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly env: EnvService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
    @Inject(PHOTO) private readonly photos: PhotoPort,
  ) {}

  async list(query: ListQueryDto, auth?: AuthContext) {
    const cacheKey = await this.listCacheKey(query);
    const cached = await this.redis.get(cacheKey);
    const page = cached
      ? (JSON.parse(cached) as {
          items: ReturnType<typeof presentInfluencer>[];
          nextCursor: number | null;
          total: number;
        })
      : await this.loadList(query, cacheKey);
    const favorites = await this.favoriteSet(auth);
    return {
      items: page.items.map((item) => ({
        ...item,
        favorite: favorites.has(item.id),
      })),
      nextCursor: page.nextCursor,
      total: page.total,
    };
  }

  async directory(auth?: AuthContext) {
    const records = listedOf(await this.loadRecords());
    const favorites = await this.favoriteSet(auth);
    const featuredRow =
      records.find((item) => item.featured) ??
      [...records].sort((a, b) => pullupScore(b) - pullupScore(a))[0];
    const featured = featuredRow
      ? presentInfluencer(featuredRow, favorites.has(featuredRow.id))
      : null;
    return {
      followers: records.reduce((sum, item) => sum + totalFollowers(item), 0),
      verified: records.length,
      perNetwork: Object.fromEntries(
        Object.keys(NET).map((key) => [
          key,
          records.filter((item) => item.net[key]).length,
        ]),
      ),
      featured,
    };
  }

  async carousel(filter: string, auth?: AuthContext) {
    const extras = await this.carouselExtras(auth);
    const items = carouselOf(
      await this.loadRecords(),
      filter || 'reco',
      extras,
    );
    return items.map((item) =>
      presentInfluencer(item, extras.favorites.has(item.id)),
    );
  }

  async profile(handle: string, auth?: AuthContext) {
    const row = await this.db.influencer.findUnique({
      where: { handle: handle.toLowerCase() },
    });
    if (!row || !canSeeProfile(row, auth)) {
      return null;
    }
    const record = (await this.hydrate([row]))[0]!;
    const favorites = await this.favoriteSet(auth);
    const reviews = await this.db.review.findMany({
      where: { influencerId: row.id },
      orderBy: { createdAt: 'desc' },
    });
    const completed = await this.db.campaign.findMany({
      where: { influencerId: row.id, status: 'completed' },
      include: { brand: { select: { name: true } } },
      orderBy: { completedAt: 'desc' },
      take: 12,
    });
    return {
      influencer: presentInfluencer(record, favorites.has(record.id)),
      own: auth?.role === 'influencer' && auth.profileId === row.id,
      reviews: reviews.map((review) => ({
        brand: review.brandName,
        stars: review.stars,
        text: review.text,
        at: review.createdAt.toISOString(),
      })),
      recent: completed.map((campaign) => ({
        id: campaign.id,
        brand: campaign.brand.name,
        fmt: campaign.offerFormat,
        net: campaign.offerNet,
        createdAt: campaign.createdAt.toISOString(),
        perf:
          campaign.perfViews == null
            ? null
            : {
                views: campaign.perfViews,
                likes: campaign.perfLikes,
                comments: campaign.perfComments,
                shares: campaign.perfShares,
                clicks: campaign.perfClicks,
              },
      })),
    };
  }

  async recordVisit(
    id: string,
    auth: AuthContext | undefined,
    ip: string,
    userAgent: string,
  ) {
    const row = await this.db.influencer.findUnique({ where: { id } });
    if (!row || (auth?.role === 'influencer' && auth.profileId === id)) {
      return null;
    }
    const day = utcDay();
    const stamp = createHash('sha256')
      .update(`${ip}|${userAgent}`)
      .digest('hex')
      .slice(0, 24);
    const key = `inf:visit:${id}:${day.toISOString().slice(0, 10)}:${stamp}`;
    if (await this.redis.get(key)) {
      return null;
    }
    const seconds = Math.max(
      60,
      Math.ceil((day.getTime() + 86_400_000 - Date.now()) / 1000),
    );
    await this.redis.set(key, '1', seconds);
    await this.db.profileViewDaily.upsert({
      where: { influencerId_day: { influencerId: id, day } },
      update: { views: { increment: 1 } },
      create: { influencerId: id, day, views: 1 },
    });
    return null;
  }

  async toggleFavorite(id: string, auth?: AuthContext) {
    if (auth?.role !== 'brand') {
      throw new AppError(FAVORITE_FORBIDDEN, 403);
    }
    const exists = await this.db.influencer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new AppError('Profil introuvable.', 404);
    }
    const key = {
      brandId_influencerId: { brandId: auth.profileId, influencerId: id },
    };
    const current = await this.db.favorite.findUnique({ where: key });
    if (current) {
      await this.db.favorite.delete({ where: key });
      return { favorite: false, message: 'Retiré de votre sélection.' };
    }
    await this.db.favorite.create({
      data: { brandId: auth.profileId, influencerId: id },
    });
    return { favorite: true, message: 'Ajouté à votre sélection.' };
  }

  async sendRequest(
    id: string,
    dto: ContactRequestDto,
    auth: AuthContext | undefined,
    ip: string,
  ) {
    await this.assertTurnstile(dto.turnstileToken, auth, ip);
    const hour = new Date().toISOString().slice(0, 13);
    const count = await this.redis.incr(`inf:req:${ip}:${hour}`, 3600);
    if (count > 5) {
      throw new AppError('Trop de demandes. Réessayez plus tard.', 429);
    }
    const influencer = await this.db.influencer.findUnique({ where: { id } });
    if (!influencer) {
      throw new AppError('Profil introuvable.', 404);
    }
    await this.db.contactRequest.create({
      data: {
        influencerId: id,
        fromName: dto.from,
        contact: dto.contact,
        message: dto.msg,
        type: dto.type,
        senderUserId: auth?.userId ?? null,
        ip,
      },
    });
    await this.db.influencer.update({
      where: { id },
      data: { contactsCount: { increment: 1 } },
    });
    await this.notify.notify(
      id,
      `Nouvelle demande de ${dto.type.toLowerCase()} de ${dto.from}.`,
      '/espace?tab=demandes',
    );
    await this.bumpCache();
    return { message: 'Demande envoyée.' };
  }

  async updateVitrine(id: string, dto: VitrineDto, auth: AuthContext) {
    if (auth.role !== 'influencer' || auth.profileId !== id) {
      throw forbidden();
    }
    assertVitrine(dto);
    const row = await this.db.influencer.findUnique({ where: { id } });
    if (!row) {
      throw new AppError('Profil introuvable.', 404);
    }
    const rates = mergeRates(
      (row.rates as unknown as RateJson[]) ?? [],
      dto.rates,
    );
    const cats = selectedCats(dto.cats.slice(0, 3));
    const bio = dto.bio.trim() || row.bio;
    const record = toRecord({ ...row, cats, days: dto.days, rates, bio }, []);
    const derived = derivedOf(record);
    await this.db.influencer.update({
      where: { id },
      data: {
        bio,
        cats,
        days: dto.days,
        rates: rates as unknown as Prisma.InputJsonValue,
        totalFollowers: derived.totalFollowers,
        avgEngagement: derived.avgEngagement,
        minPrice: derived.minPrice,
        badgeKey: derived.badgeKey,
        pullupScore: derived.pullupScore,
      },
    });
    await this.bumpCache();
    return { message: 'Vitrine enregistrée.' };
  }

  async updatePhoto(
    id: string,
    dto: PhotoDto,
    auth: AuthContext,
    ip?: string | null,
  ) {
    const owner = auth.role === 'influencer' && auth.profileId === id;
    const admin = auth.role === 'admin';
    if (!owner && !admin) {
      throw forbidden();
    }
    if (admin && dto.consent !== true) {
      throw new AppError(
        "L'accord écrit de l'influenceur (droit à l'image) est obligatoire.",
        422,
      );
    }
    const row = await this.db.influencer.findUnique({ where: { id } });
    if (!row) {
      throw new AppError('Profil introuvable.', 404);
    }
    const photoUrl = dto.photo
      ? await this.photos.saveProfilePhoto(dto.photo)
      : null;
    await this.photos.deletePhoto(row.photoUrl);
    await this.db.influencer.update({ where: { id }, data: { photoUrl } });
    if (admin) {
      await this.audit.record({
        actorUserId: auth.userId,
        action: dto.photo
          ? 'influencer_photo_update'
          : 'influencer_photo_remove',
        targetType: 'Influencer',
        targetId: id,
        data: {
          consent: true,
          before: { photo: row.photoUrl },
          after: { photo: photoUrl },
        },
        ip,
      });
    }
    await this.bumpCache();
    return { message: dto.photo ? 'Photo mise à jour.' : 'Photo retirée.' };
  }

  async presentedByHandle(handle: string, auth?: AuthContext) {
    const row = await this.db.influencer.findUnique({
      where: { handle: handle.toLowerCase() },
    });
    if (!row || !isListed(row)) {
      return null;
    }
    const record = (await this.hydrate([row]))[0]!;
    const favorites = await this.favoriteSet(auth);
    return presentInfluencer(record, favorites.has(record.id));
  }

  async listedPresented(auth?: AuthContext) {
    const favorites = await this.favoriteSet(auth);
    return listedOf(await this.loadRecords()).map((item) =>
      presentInfluencer(item, favorites.has(item.id)),
    );
  }

  async presentByIds(ids: string[], favorite = true) {
    if (!ids.length) {
      return [];
    }
    const rows = await this.db.influencer.findMany({
      where: { id: { in: ids } },
    });
    const records = await this.hydrate(rows);
    const byId = new Map(records.map((item) => [item.id, item]));
    return ids
      .map((id) => byId.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map((item) => presentInfluencer(item, favorite));
  }

  async presentOwn(auth: AuthContext) {
    const row = await this.db.influencer.findUnique({
      where: { id: auth.profileId },
      include: { user: { select: { email: true } } },
    });
    if (!row) {
      throw new AppError('Profil introuvable.', 404);
    }
    const record = (await this.hydrate([row]))[0]!;
    return {
      ...presentInfluencer(record, false),
      email: row.user.email,
      phone: row.phone,
    };
  }

  private async loadList(query: ListQueryDto, cacheKey: string) {
    const filtered = filterListed(await this.loadRecords(), query);
    const page = pageOf(filtered, query.cursor, query.limit);
    const payload = {
      items: page.items.map((item) => presentInfluencer(item, false)),
      nextCursor: page.nextCursor,
      total: page.total,
    };
    await this.redis.set(cacheKey, JSON.stringify(payload), 60);
    return payload;
  }

  private async loadRecords() {
    const rows = await this.db.influencer.findMany();
    return this.hydrate(rows);
  }

  private async hydrate(rows: InfluencerRow[]) {
    if (!rows.length) {
      return [];
    }
    const from = utcDay();
    from.setUTCDate(from.getUTCDate() - 29);
    const views = await this.db.profileViewDaily.findMany({
      where: {
        influencerId: { in: rows.map((row) => row.id) },
        day: { gte: from },
      },
    });
    const byId = new Map<string, Array<{ day: Date; views: number }>>();
    for (const row of views) {
      const list = byId.get(row.influencerId) ?? [];
      list.push(row);
      byId.set(row.influencerId, list);
    }
    return rows.map((row) =>
      toRecord(row, viewsSeries(byId.get(row.id) ?? [])),
    );
  }

  private async favoriteSet(auth?: AuthContext): Promise<Set<string>> {
    if (auth?.role !== 'brand') {
      return new Set();
    }
    const rows = await this.db.favorite.findMany({
      where: { brandId: auth.profileId },
      select: { influencerId: true },
    });
    return new Set(rows.map((row) => row.influencerId));
  }

  private async carouselExtras(auth?: AuthContext) {
    const favorites = await this.favoriteSet(auth);
    if (auth?.role !== 'brand') {
      return { themes: new Set<string>(), favorites, used: new Set<string>() };
    }
    const campaigns = await this.db.campaign.findMany({
      where: { brandId: auth.profileId },
      select: { influencerId: true, briefTheme: true },
    });
    return {
      themes: new Set(
        campaigns.map((campaign) => campaign.briefTheme).filter(Boolean),
      ),
      favorites,
      used: new Set(campaigns.map((campaign) => campaign.influencerId)),
    };
  }

  private async listCacheKey(query: ListQueryDto) {
    const version = (await this.redis.get('inf:cache:ver')) ?? '0';
    return `inf:list:${version}:${JSON.stringify(query)}`;
  }

  hydrateRows(rows: InfluencerRow[]) {
    return this.hydrate(rows);
  }

  async refreshListing() {
    return this.bumpCache();
  }

  private async bumpCache() {
    const current = Number((await this.redis.get('inf:cache:ver')) ?? '0');
    await this.redis.set('inf:cache:ver', String(current + 1));
  }

  private async assertTurnstile(
    token: string | undefined,
    auth: AuthContext | undefined,
    ip: string,
  ) {
    const secret = this.env.get('TURNSTILE_SECRET');
    if (!secret || auth) {
      return;
    }
    if (!token) {
      throw new AppError('Vérification anti-robot requise.', 400);
    }
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      },
    );
    const payload = (await response.json()) as { success?: boolean };
    if (!payload.success) {
      throw new AppError('Vérification anti-robot échouée.', 400);
    }
  }
}
