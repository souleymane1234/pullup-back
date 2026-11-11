import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Campaign } from '@prisma/client';
import { AUTO_VALIDATE_HOURS } from '../../../common/catalog.js';
import { formatFcfa } from '../../../common/format.js';
import { AppError, forbidden } from '../../../common/http/app.error.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { AuditService } from '../../audit/service/audit.service.js';
import { LedgerService } from '../../finance/service/ledger.service.js';
import { derivedOf } from '../../influencers/domain/metrics.js';
import type { NetMap } from '../../influencers/domain/types.js';
import { toRecord } from '../../influencers/domain/mapper.js';
import { moderateMessage } from '../domain/moderate.js';
import { campaignMoney } from '../domain/money.js';
import { estimatePerf } from '../domain/perf.js';
import {
  nextQualityScore,
  onTimeSample,
  ratingAfter,
} from '../domain/scores.js';
import { assertTransition, isParty } from '../domain/transitions.js';

const MESSAGE_LIMIT = 30;
const HOUR_MS = 60 * 60 * 1000;
const REMINDER_48 = 'Relance à 48 h';
const REMINDER_DATE = 'Rappel de publication';

const LOAD = {
  brand: true,
  influencer: true,
  events: { orderBy: { createdAt: 'asc' as const } },
  messages: { orderBy: { createdAt: 'asc' as const } },
  review: true,
};

@Injectable()
export class CampaignLifecycleService {
  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly redis: RedisService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
    private readonly audit: AuditService,
  ) {}

  async act(
    id: string,
    action: string,
    auth: AuthContext,
    payload: Record<string, unknown> = {},
  ) {
    const outcome = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${id} FOR UPDATE`;
      const campaign = await tx.campaign.findUnique({
        where: { id },
        include: { brand: true, influencer: true },
      });
      if (!campaign) {
        throw new AppError('Campagne introuvable.', 404);
      }
      const before = campaign.status;
      const asserted = assertTransition(
        action,
        auth.role,
        campaign.status,
        isParty(auth, campaign),
      );
      const result = await this.apply(
        tx,
        asserted,
        campaign,
        payload,
        auth.role === 'admin',
      );
      const after = await tx.campaign.findUnique({
        where: { id },
        select: { status: true },
      });
      return { result, before, after: after?.status ?? before };
    });
    if (outcome.after === 'completed') {
      await this.bumpInfluencerCache();
    }
    if (auth.role === 'admin') {
      await this.audit.record({
        actorUserId: auth.userId,
        action: `campaign_${action}`,
        targetType: 'Campaign',
        targetId: id,
        data: {
          before: { status: outcome.before },
          after: { status: outcome.after },
          payload: payload as Prisma.InputJsonValue,
        },
      });
    }
    return outcome.result;
  }

  async review(
    id: string,
    auth: AuthContext,
    input: { stars: number; text?: string },
  ) {
    const campaign = await this.db.campaign.findUnique({
      where: { id },
      include: { brand: true, influencer: true, review: true },
    });
    if (
      !campaign ||
      auth.role !== 'brand' ||
      auth.profileId !== campaign.brandId ||
      campaign.status !== 'completed' ||
      campaign.review
    ) {
      throw forbidden();
    }
    const stars = Number(input.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      throw forbidden();
    }
    const next = ratingAfter(
      campaign.influencer.scoreRating,
      campaign.influencer.scoreReviews,
      stars,
    );
    const derived = derivedOf(
      toRecord(
        {
          ...campaign.influencer,
          scoreRating: next.rating,
          scoreReviews: next.reviews,
        } as never,
        [],
      ),
    );
    try {
      await this.db.$transaction([
        this.db.review.create({
          data: {
            campaignId: campaign.id,
            influencerId: campaign.influencerId,
            brandName: campaign.brand.name,
            stars,
            text: String(input.text ?? '').trim(),
          },
        }),
        this.db.influencer.update({
          where: { id: campaign.influencerId },
          data: {
            scoreRating: next.rating,
            scoreReviews: next.reviews,
            pullupScore: derived.pullupScore,
          },
        }),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw forbidden();
      }
      throw error;
    }
    await this.bumpInfluencerCache();
    await this.notify.notify(
      campaign.influencerId,
      `${campaign.brand.name} vous a laissé un avis ${stars}/5.`,
      `/i/${campaign.influencer.handle}`,
    );
    return { message: 'Merci ! Votre avis est publié sur la vitrine.' };
  }

  async message(id: string, auth: AuthContext, text: string, ip: string) {
    const body = text.trim();
    if (!body) {
      throw new AppError('Écrivez un message.', 422);
    }
    if (body.length > 2000) {
      throw new AppError('2 000 caractères maximum.', 422);
    }
    const count = await this.redis.incr(`rl:msg:${auth.userId}:${ip}`, 60);
    if (count > MESSAGE_LIMIT) {
      throw new AppError('Trop de requêtes. Réessayez dans une minute.', 429);
    }
    const campaign = await this.db.campaign.findUnique({
      where: { id },
      include: { brand: true, influencer: true },
    });
    if (!campaign) {
      throw new AppError('Campagne introuvable.', 404);
    }
    if (!isParty(auth, campaign)) {
      throw forbidden();
    }
    const stored = moderateMessage(body, campaign.status);
    await this.db.campaignMessage.create({
      data: {
        campaignId: campaign.id,
        fromRole: auth.role,
        authorUserId: auth.userId,
        body: stored,
      },
    });
    const link = `/c/${campaign.id}`;
    if (auth.role === 'brand') {
      await this.notify.notify(
        campaign.influencerId,
        `Nouveau message de ${campaign.brand.name} sur « ${campaign.briefTitle} ».`,
        link,
      );
    } else if (auth.role === 'influencer') {
      await this.notify.notify(
        campaign.brandId,
        `Nouveau message de ${campaign.influencer.name} sur « ${campaign.briefTitle} ».`,
        link,
      );
    } else {
      await this.notify.notify(
        campaign.influencerId,
        `Message de l'équipe PULLUP sur ${campaign.ref}.`,
        link,
      );
      await this.notify.notify(
        campaign.brandId,
        `Message de l'équipe PULLUP sur ${campaign.ref}.`,
        link,
      );
    }
    return { message: 'Message envoyé.' };
  }

  async redirect(ref: string, ip: string, userAgent: string): Promise<string> {
    const campaign = await this.db.campaign.findUnique({ where: { ref } });
    if (!campaign) {
      throw new AppError('Campagne introuvable.', 404);
    }
    const ipHash = createHash('sha256').update(ip).digest('hex').slice(0, 24);
    const day = new Date();
    const start = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()),
    );
    const existing = await this.db.utmClick.findFirst({
      where: { campaignId: campaign.id, ipHash, createdAt: { gte: start } },
    });
    if (!existing) {
      await this.db.utmClick.create({
        data: {
          campaignId: campaign.id,
          ipHash,
          userAgent: userAgent.slice(0, 500),
        },
      });
      const clicks = await this.db.utmClick.count({
        where: { campaignId: campaign.id },
      });
      await this.db.campaign.update({
        where: { id: campaign.id },
        data: { perfClicks: clicks },
      });
    }
    return campaign.utmUrl;
  }

  async autoValidatePublished(): Promise<{ message: string }> {
    const cutoff = new Date(Date.now() - AUTO_VALIDATE_HOURS * HOUR_MS);
    const pending = await this.db.campaign.findMany({
      where: { status: 'published', publishedAt: { lte: cutoff } },
      include: { brand: true, influencer: true },
    });
    let count = 0;
    for (const campaign of pending) {
      try {
        const done = await this.db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaign.id} FOR UPDATE`;
          const fresh = await tx.campaign.findUnique({
            where: { id: campaign.id },
            include: { brand: true, influencer: true },
          });
          if (!fresh || fresh.status !== 'published') {
            return false;
          }
          await this.validate(tx, fresh, true);
          return true;
        });
        if (!done) {
          continue;
        }
        await this.bumpInfluencerCache();
        await this.audit.record({
          action: 'campaign_auto_validate',
          targetType: 'Campaign',
          targetId: campaign.id,
          data: {
            before: { status: 'published' },
            after: { status: 'completed' },
          },
        });
        count += 1;
      } catch {
        // déjà traitée ou séquestre déjà fermé
      }
    }
    return {
      message: count
        ? `${count} campagne(s) validée(s) automatiquement.`
        : 'Aucune publication en attente de validation.',
    };
  }

  async runScheduledJobs(): Promise<void> {
    await this.autoValidatePublished();
    await this.remindUnanswered();
    await this.refundUnanswered();
    await this.remindPublication();
  }

  private async accept(tx: Prisma.TransactionClient, campaign: Loaded) {
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
    await this.addEvent(
      tx,
      campaign.id,
      'accepted',
      `${campaign.influencer.name} a accepté la campagne`,
    );
    await this.notify.notify(
      campaign.brandId,
      `${campaign.influencer.name} a accepté « ${campaign.briefTitle} ».`,
      `/c/${campaign.id}`,
    );
    return { message: 'Campagne acceptée. Publiez à la date prévue.' };
  }

  private async decline(tx: Prisma.TransactionClient, campaign: Loaded) {
    await this.ledger.refundEscrow(campaignMoney(campaign), tx);
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'declined' },
    });
    await this.addEvent(
      tx,
      campaign.id,
      'declined',
      "Refusée par l'influenceur · remboursement sur le solde annonceur",
    );
    await this.notify.notify(
      campaign.brandId,
      `${campaign.influencer.name} a refusé « ${campaign.briefTitle} ». ${formatFcfa(campaign.amountFcfa)} recrédités sur votre solde.`,
      `/c/${campaign.id}`,
    );
    return { message: "Campagne refusée. L'annonceur est remboursé." };
  }

  private async proof(
    tx: Prisma.TransactionClient,
    campaign: Loaded,
    payload: Record<string, unknown>,
  ) {
    const url = String(payload.url ?? '').trim();
    if (!/^https?:\/\//.test(url)) {
      throw new AppError('Collez le lien complet de votre publication.', 422);
    }
    const nets = (campaign.influencer.nets as unknown as NetMap) ?? {};
    const network = nets[campaign.offerNet] ?? [10_000, 5];
    const perf = estimatePerf(network[0], network[1], campaign.offerNet);
    const clicks = await tx.utmClick.count({
      where: { campaignId: campaign.id },
    });
    await tx.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'published',
        proofUrl: url,
        proofNote: String(payload.note ?? ''),
        proofAt: new Date(),
        publishedAt: new Date(),
        perfViews: perf.views,
        perfLikes: perf.likes,
        perfComments: perf.comments,
        perfShares: perf.shares,
        perfClicks: clicks > 0 ? clicks : perf.clicks,
      },
    });
    await this.addEvent(
      tx,
      campaign.id,
      'published',
      'Preuve de publication envoyée',
    );
    await this.notify.notify(
      campaign.brandId,
      `${campaign.influencer.name} a publié « ${campaign.briefTitle} ». Validez pour libérer les fonds.`,
      `/c/${campaign.id}`,
    );
    return { message: 'Preuve envoyée. Paiement à la validation.' };
  }

  private async cancel(tx: Prisma.TransactionClient, campaign: Loaded) {
    await this.ledger.refundEscrow(campaignMoney(campaign), tx);
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'cancelled' },
    });
    await this.addEvent(
      tx,
      campaign.id,
      'cancelled',
      "Annulée par l'annonceur · remboursement sur le solde",
    );
    await this.notify.notify(
      campaign.influencerId,
      `La campagne « ${campaign.briefTitle} » a été annulée par l'annonceur.`,
      `/c/${campaign.id}`,
    );
    return {
      message: `${formatFcfa(campaign.amountFcfa)} recrédités sur votre solde PULLUP.`,
    };
  }

  private async validate(
    tx: Prisma.TransactionClient,
    campaign: Loaded,
    automatic: boolean,
  ) {
    await this.complete(
      tx,
      campaign,
      automatic
        ? 'Validation automatique après 72 h · fonds libérés'
        : "Validée par l'annonceur · fonds libérés",
      false,
    );
    return { message: "Fonds libérés à l'influenceur." };
  }

  private async dispute(
    tx: Prisma.TransactionClient,
    campaign: Loaded,
    payload: Record<string, unknown>,
  ) {
    const reason = String(payload.reason ?? '').trim();
    if (!reason) {
      throw new AppError('Décrivez le problème rencontré.', 422);
    }
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'dispute', disputeReason: reason },
    });
    await this.addEvent(
      tx,
      campaign.id,
      'dispute',
      "Litige ouvert par l'annonceur",
    );
    await this.notify.notify(
      'admin',
      `Litige ouvert sur ${campaign.ref}.`,
      `/c/${campaign.id}`,
    );
    await this.notify.notify(
      campaign.influencerId,
      `Un litige a été ouvert sur « ${campaign.briefTitle} ».`,
      `/c/${campaign.id}`,
    );
    return { message: "Litige transmis à l'équipe PULLUP." };
  }

  private async release(tx: Prisma.TransactionClient, campaign: Loaded) {
    await this.complete(
      tx,
      campaign,
      "Litige tranché en faveur de l'influenceur · fonds libérés",
      true,
    );
    await this.notify.notify(
      campaign.brandId,
      `Litige ${campaign.ref} clos : fonds versés à l'influenceur.`,
      `/c/${campaign.id}`,
    );
    return { message: "Fonds versés à l'influenceur." };
  }

  private async refund(tx: Prisma.TransactionClient, campaign: Loaded) {
    await this.ledger.refundEscrow(campaignMoney(campaign), tx);
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'refunded' },
    });
    await this.addEvent(
      tx,
      campaign.id,
      'refunded',
      "Litige tranché en faveur de l'annonceur · remboursement",
    );
    await this.notify.notify(
      campaign.brandId,
      `Litige ${campaign.ref} clos : ${formatFcfa(campaign.amountFcfa)} recrédités sur votre solde.`,
      `/c/${campaign.id}`,
    );
    await this.notify.notify(
      campaign.influencerId,
      `Litige ${campaign.ref} clos en faveur de l'annonceur.`,
      `/c/${campaign.id}`,
    );
    return { message: 'Annonceur remboursé.' };
  }

  private async complete(
    tx: Prisma.TransactionClient,
    campaign: Loaded,
    note: string,
    hadDispute: boolean,
  ) {
    await this.ledger.releaseEscrow(campaignMoney(campaign), tx);
    await tx.campaign.update({
      where: { id: campaign.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    await this.addEvent(tx, campaign.id, 'completed', note);
    const doneBefore = campaign.influencer.scoreDone;
    const onTime = nextQualityScore(
      campaign.influencer.scoreOnTime,
      doneBefore,
      onTimeSample(campaign.publishedAt, campaign.briefDate),
    );
    const brief = nextQualityScore(
      campaign.influencer.scoreBrief,
      doneBefore,
      hadDispute ? 70 : 100,
    );
    const nextDone = doneBefore + 1;
    const derived = derivedOf(
      toRecord(
        {
          ...campaign.influencer,
          scoreDone: nextDone,
          scoreOnTime: onTime,
          scoreBrief: brief,
        } as never,
        [],
      ),
    );
    await tx.influencer.update({
      where: { id: campaign.influencerId },
      data: {
        scoreDone: nextDone,
        scoreOnTime: onTime,
        scoreBrief: brief,
        pullupScore: derived.pullupScore,
      },
    });
    await this.notify.notify(
      campaign.influencerId,
      `${formatFcfa(campaign.payoutFcfa)} ajoutés à votre solde disponible (${campaign.ref}).`,
      '/espace?tab=wallet',
    );
  }

  private async apply(
    tx: Prisma.TransactionClient,
    action: ReturnType<typeof assertTransition>,
    campaign: Loaded,
    payload: Record<string, unknown>,
    asAdmin: boolean,
  ) {
    switch (action) {
      case 'accept':
        return this.accept(tx, campaign);
      case 'decline':
        return this.decline(tx, campaign);
      case 'proof':
        return this.proof(tx, campaign, payload);
      case 'cancel':
        return this.cancel(tx, campaign);
      case 'validate':
        return this.validate(tx, campaign, asAdmin);
      case 'dispute':
        return this.dispute(tx, campaign, payload);
      case 'release':
        return this.release(tx, campaign);
      case 'refund':
        return this.refund(tx, campaign);
    }
  }

  private async remindUnanswered() {
    const cutoff = new Date(Date.now() - 48 * HOUR_MS);
    const campaigns = await this.db.campaign.findMany({
      where: { status: 'paid', createdAt: { lte: cutoff } },
      include: { events: true },
    });
    for (const campaign of campaigns) {
      if (campaign.events.some((event) => event.note.startsWith(REMINDER_48))) {
        continue;
      }
      await this.db.campaignEvent.create({
        data: {
          campaignId: campaign.id,
          status: campaign.status,
          note: REMINDER_48,
        },
      });
      await this.notify.notify(
        campaign.influencerId,
        `Relance : acceptez la campagne sous 24 h.`,
        `/c/${campaign.id}`,
      );
    }
  }

  private async refundUnanswered() {
    const cutoff = new Date(Date.now() - AUTO_VALIDATE_HOURS * HOUR_MS);
    const campaigns = await this.db.campaign.findMany({
      where: { status: 'paid', createdAt: { lte: cutoff } },
      include: { brand: true, influencer: true },
    });
    for (const campaign of campaigns) {
      try {
        const done = await this.db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM campaigns WHERE id = ${campaign.id} FOR UPDATE`;
          const fresh = await tx.campaign.findUnique({
            where: { id: campaign.id },
          });
          if (!fresh || fresh.status !== 'paid') {
            return false;
          }
          await this.ledger.refundEscrow(campaignMoney(fresh), tx);
          await tx.campaign.update({
            where: { id: campaign.id },
            data: { status: 'cancelled' },
          });
          await this.addEvent(
            tx,
            campaign.id,
            'cancelled',
            "Sans réponse de l'influenceur sous 72 h · remboursement",
          );
          return true;
        });
        if (done) {
          await this.notify.notify(
            campaign.brandId,
            `Sans réponse de l'influenceur, ${formatFcfa(campaign.amountFcfa)} ont été recrédités (${campaign.ref}).`,
            `/c/${campaign.id}`,
          );
        }
      } catch {
        // déjà remboursée
      }
    }
  }

  private async remindPublication() {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const start = new Date(
      Date.UTC(
        tomorrow.getUTCFullYear(),
        tomorrow.getUTCMonth(),
        tomorrow.getUTCDate(),
      ),
    );
    const end = new Date(start.getTime() + 24 * HOUR_MS);
    const campaigns = await this.db.campaign.findMany({
      where: { status: 'accepted', briefDate: { gte: start, lt: end } },
      include: { events: true },
    });
    for (const campaign of campaigns) {
      if (
        campaign.events.some((event) => event.note.startsWith(REMINDER_DATE))
      ) {
        continue;
      }
      await this.db.campaignEvent.create({
        data: {
          campaignId: campaign.id,
          status: campaign.status,
          note: REMINDER_DATE,
        },
      });
      await this.notify.notify(
        campaign.influencerId,
        `Rappel : publication prévue demain pour « ${campaign.briefTitle} ».`,
        `/c/${campaign.id}`,
      );
    }
  }

  private addEvent(
    tx: Prisma.TransactionClient,
    campaignId: string,
    status: string,
    note: string,
  ) {
    return tx.campaignEvent.create({ data: { campaignId, status, note } });
  }

  private async bumpInfluencerCache() {
    const current = Number((await this.redis.get('inf:cache:ver')) ?? '0');
    await this.redis.set('inf:cache:ver', String(current + 1));
  }
}

type Loaded = Campaign & {
  brand: { id: string; name: string };
  influencer: {
    id: string;
    handle: string;
    name: string;
    nets: unknown;
    scoreDone: number;
    scoreOnTime: number;
    scoreBrief: number;
    scoreRating: number;
    scoreReviews: number;
    scoreAuth: number;
    scoreCreat: number;
    verified: boolean;
    status: string;
    rates: unknown;
  };
};

export const campaignLoad = LOAD;
