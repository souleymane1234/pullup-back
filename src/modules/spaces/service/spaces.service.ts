import { Injectable } from '@nestjs/common';
import { HELD_STATUSES, PLANS, type PlanKey } from '../../../common/catalog.js';
import { AppError, forbidden } from '../../../common/http/app.error.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { CampaignsService } from '../../campaigns/service/campaigns.service.js';
import { InfluencersService } from '../../influencers/service/influencers.service.js';
import { campaignsCsv } from '../domain/export-csv.js';
import { presentWalletTx } from '../domain/wallet-tx.js';

@Injectable()
export class SpacesService {
  constructor(
    private readonly db: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly influencers: InfluencersService,
  ) {}

  async brandSpace(auth: AuthContext) {
    if (auth.role !== 'brand') {
      throw forbidden();
    }
    const [brand, campaigns, favoriteRows] = await Promise.all([
      this.db.brand.findUnique({
        where: { id: auth.profileId },
        include: { user: { select: { email: true } } },
      }),
      this.campaigns.list(auth),
      this.db.favorite.findMany({
        where: { brandId: auth.profileId },
        orderBy: { createdAt: 'asc' },
        select: { influencerId: true },
      }),
    ]);
    if (!brand) {
      throw new AppError('Profil introuvable.', 404);
    }
    const favorites = await this.influencers.presentByIds(
      favoriteRows.map((row) => row.influencerId),
      true,
    );
    return {
      brand: {
        id: brand.id,
        name: brand.name,
        contact: brand.contactName,
        email: brand.user.email,
        plan: brand.plan,
        sector: brand.sector,
        balance: brand.balanceFcfa,
      },
      campaigns,
      favorites,
    };
  }

  async influencerSpace(auth: AuthContext) {
    if (auth.role !== 'influencer') {
      throw forbidden();
    }
    const [influencer, campaigns, requests, wallet, entries] =
      await Promise.all([
        this.influencers.presentOwn(auth),
        this.campaigns.list(auth),
        this.db.contactRequest.findMany({
          where: { influencerId: auth.profileId },
          orderBy: { createdAt: 'desc' },
        }),
        this.db.wallet.findUnique({ where: { influencerId: auth.profileId } }),
        this.db.ledgerEntry.findMany({
          where: {
            accountType: 'influencer_wallet',
            accountId: auth.profileId,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);
    const escrow = campaigns
      .filter((campaign) =>
        (HELD_STATUSES as readonly string[]).includes(campaign.status),
      )
      .reduce((sum, campaign) => sum + campaign.payout, 0);
    return {
      influencer,
      campaigns,
      requests: requests.map((item) => ({
        id: item.id,
        infId: item.influencerId,
        from: item.fromName,
        contact: item.contact,
        msg: item.message,
        type: item.type,
        at: item.createdAt.toISOString(),
      })),
      wallet: {
        available: wallet?.availableFcfa ?? 0,
        tx: presentWalletTx(entries),
      },
      escrow,
    };
  }

  async updateBrand(
    auth: AuthContext,
    input: { name: string; contact: string; sector: string },
  ) {
    if (auth.role !== 'brand') {
      throw forbidden();
    }
    const name = input.name.trim();
    if (!name) {
      throw new AppError('Indiquez le nom de la marque.', 422);
    }
    await this.db.brand.update({
      where: { id: auth.profileId },
      data: {
        name,
        contactName: input.contact.trim(),
        sector: input.sector.trim(),
      },
    });
    return { message: 'Profil enregistré.' };
  }

  async exportCampaignsCsv(auth: AuthContext): Promise<string> {
    if (auth.role !== 'brand') {
      throw forbidden();
    }
    const brand = await this.db.brand.findUnique({
      where: { id: auth.profileId },
      select: { plan: true },
    });
    if (!brand || !PLANS[brand.plan as PlanKey].exportCsv) {
      throw forbidden();
    }
    return campaignsCsv(await this.campaigns.list(auth));
  }
}
