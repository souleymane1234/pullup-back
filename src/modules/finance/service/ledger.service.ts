import { Injectable } from '@nestjs/common';
import type { CampaignStatus, Prisma } from '@prisma/client';
import { HELD_STATUSES } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import {
  assertBalanced,
  applySigned,
  balanceToEscrowLines,
  balanceToRevenueLines,
  brandCreditLines,
  collectRevenueLines,
  collectToEscrowLines,
  payoutFailedLines,
  escrowToBrandLines,
  refundEscrowLines,
  releaseEscrowLines,
  revenueToBrandLines,
  walletToPayoutLines,
  type CampaignMoney,
  type LedgerLine,
} from '../domain/ledger.js';

@Injectable()
export class LedgerService {
  constructor(private readonly db: PrismaService) {}

  collectToEscrow(campaign: CampaignMoney, amountPsp: number) {
    return this.db.$transaction(async (tx) => {
      await this.upsertHold(tx, campaign);
      await this.lockEscrow(tx, campaign.id);
      await this.post(tx, collectToEscrowLines(campaign, amountPsp));
    });
  }

  balanceToEscrow(brandId: string, campaign: CampaignMoney, amount: number) {
    return this.db.$transaction(async (tx) => {
      await this.lockBrand(tx, brandId);
      const brand = await tx.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        throw new AppError('Profil introuvable.', 404);
      }
      const next = applySigned(brand.balanceFcfa, 'debit', amount);
      await this.upsertHold(tx, campaign);
      await this.lockEscrow(tx, campaign.id);
      await this.post(tx, balanceToEscrowLines(brandId, campaign, amount));
      await tx.brand.update({
        where: { id: brandId },
        data: { balanceFcfa: next },
      });
    });
  }

  releaseEscrow(campaign: CampaignMoney, tx?: Prisma.TransactionClient) {
    return this.inTx(tx, async (client) => {
      await this.lockEscrow(client, campaign.id);
      await this.lockWallet(client, campaign.influencerId);
      const hold = await client.escrowHold.findUnique({
        where: { campaignId: campaign.id },
      });
      if (!hold || hold.state !== 'open') {
        throw new AppError('Séquestre introuvable.', 404);
      }
      const escrow = await this.accountOf(client, 'escrow', campaign.id);
      if (escrow < campaign.amount) {
        throw new AppError('Solde insuffisant.', 422);
      }
      await this.post(client, releaseEscrowLines(campaign));
      const wallet = await client.wallet.findUnique({
        where: { influencerId: campaign.influencerId },
      });
      await client.wallet.update({
        where: { influencerId: campaign.influencerId },
        data: {
          availableFcfa: applySigned(
            wallet?.availableFcfa ?? 0,
            'credit',
            campaign.payout,
          ),
        },
      });
      await client.escrowHold.update({
        where: { campaignId: campaign.id },
        data: { state: 'released' },
      });
    });
  }

  refundEscrow(campaign: CampaignMoney, tx?: Prisma.TransactionClient) {
    return this.inTx(tx, async (client) => {
      await this.lockEscrow(client, campaign.id);
      await this.lockBrand(client, campaign.brandId);
      const hold = await client.escrowHold.findUnique({
        where: { campaignId: campaign.id },
      });
      if (!hold || hold.state !== 'open') {
        throw new AppError('Séquestre introuvable.', 404);
      }
      await this.post(client, refundEscrowLines(campaign));
      const brand = await client.brand.findUnique({
        where: { id: campaign.brandId },
      });
      await client.brand.update({
        where: { id: campaign.brandId },
        data: {
          balanceFcfa: applySigned(
            brand?.balanceFcfa ?? 0,
            'credit',
            campaign.amount,
          ),
        },
      });
      await client.escrowHold.update({
        where: { campaignId: campaign.id },
        data: { state: 'refunded' },
      });
    });
  }

  escrowToBrand(campaign: CampaignMoney, amount: number) {
    return this.db.$transaction(async (tx) => {
      await this.lockEscrow(tx, campaign.id);
      await this.lockBrand(tx, campaign.brandId);
      const brand = await tx.brand.findUnique({
        where: { id: campaign.brandId },
      });
      if (!brand) {
        throw new AppError('Profil introuvable.', 404);
      }
      await this.post(tx, escrowToBrandLines(campaign, amount));
      await tx.brand.update({
        where: { id: campaign.brandId },
        data: { balanceFcfa: applySigned(brand.balanceFcfa, 'credit', amount) },
      });
      const remaining = await this.accountOf(tx, 'escrow', campaign.id);
      if (remaining <= 0) {
        await tx.escrowHold.updateMany({
          where: { campaignId: campaign.id, state: 'open' },
          data: { state: 'refunded' },
        });
      }
    });
  }

  walletToPayout(
    influencerId: string,
    amount: number,
    label: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTx(tx, async (client) => {
      await this.lockWallet(client, influencerId);
      const wallet = await client.wallet.findUnique({
        where: { influencerId },
      });
      if ((wallet?.availableFcfa ?? 0) < amount) {
        throw new AppError('Montant supérieur à votre solde disponible.', 422);
      }
      const next = applySigned(wallet?.availableFcfa ?? 0, 'debit', amount);
      await this.post(client, walletToPayoutLines(influencerId, amount, label));
      await client.wallet.update({
        where: { influencerId },
        data: { availableFcfa: next },
      });
    });
  }

  payoutFailed(
    influencerId: string,
    amount: number,
    label: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTx(tx, async (client) => {
      await this.lockWallet(client, influencerId);
      const wallet = await client.wallet.findUnique({
        where: { influencerId },
      });
      const next = applySigned(wallet?.availableFcfa ?? 0, 'credit', amount);
      await this.post(client, payoutFailedLines(influencerId, amount, label));
      await client.wallet.update({
        where: { influencerId },
        data: { availableFcfa: next },
      });
    });
  }

  collectRevenue(purpose: string, amount: number) {
    return this.db.$transaction(async (tx) => {
      await this.post(tx, collectRevenueLines(purpose, amount));
    });
  }

  balanceToRevenue(
    brandId: string,
    amount: number,
    label: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTx(tx, async (client) => {
      await this.lockBrand(client, brandId);
      const brand = await client.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        throw new AppError('Profil introuvable.', 404);
      }
      const next = applySigned(brand.balanceFcfa, 'debit', amount);
      await this.post(client, balanceToRevenueLines(brandId, amount, label));
      await client.brand.update({
        where: { id: brandId },
        data: { balanceFcfa: next },
      });
    });
  }

  creditBrand(
    brandId: string,
    amount: number,
    label: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTx(tx, async (client) => {
      await this.lockBrand(client, brandId);
      const brand = await client.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        throw new AppError('Profil introuvable.', 404);
      }
      const next = applySigned(brand.balanceFcfa, 'credit', amount);
      await this.post(client, brandCreditLines(brandId, amount, label));
      await client.brand.update({
        where: { id: brandId },
        data: { balanceFcfa: next },
      });
    });
  }

  revenueToBrand(
    brandId: string,
    amount: number,
    label: string,
    tx?: Prisma.TransactionClient,
  ) {
    return this.inTx(tx, async (client) => {
      await this.lockBrand(client, brandId);
      const brand = await client.brand.findUnique({ where: { id: brandId } });
      if (!brand) {
        throw new AppError('Profil introuvable.', 404);
      }
      const next = applySigned(brand.balanceFcfa, 'credit', amount);
      await this.post(client, revenueToBrandLines(brandId, amount, label));
      await client.brand.update({
        where: { id: brandId },
        data: { balanceFcfa: next },
      });
    });
  }

  async escrowOf(influencerId: string): Promise<number> {
    const campaigns = await this.db.campaign.findMany({
      where: {
        influencerId,
        status: { in: [...HELD_STATUSES] as CampaignStatus[] },
      },
      select: { payoutFcfa: true },
    });
    return campaigns.reduce((sum, campaign) => sum + campaign.payoutFcfa, 0);
  }

  private inTx<T>(
    tx: Prisma.TransactionClient | undefined,
    fn: (client: Prisma.TransactionClient) => Promise<T>,
  ) {
    return tx ? fn(tx) : this.db.$transaction(fn);
  }

  private async post(tx: Prisma.TransactionClient, lines: LedgerLine[]) {
    assertBalanced(lines);
    await tx.ledgerEntry.createMany({
      data: lines.map((line) => ({
        txId: line.txId,
        accountType: line.accountType,
        accountId: line.accountId,
        campaignId: line.campaignId,
        direction: line.direction,
        amountFcfa: line.amountFcfa,
        label: line.label,
      })),
    });
  }

  private async upsertHold(
    tx: Prisma.TransactionClient,
    campaign: CampaignMoney,
  ) {
    await tx.escrowHold.upsert({
      where: { campaignId: campaign.id },
      create: {
        campaignId: campaign.id,
        brandId: campaign.brandId,
        influencerId: campaign.influencerId,
        amountFcfa: campaign.amount,
        feeFcfa: campaign.fee,
        payoutFcfa: campaign.payout,
        state: 'open',
      },
      update: {},
    });
  }

  private async accountOf(
    tx: Prisma.TransactionClient,
    type: LedgerLine['accountType'],
    id: string,
  ) {
    const rows = await tx.ledgerEntry.findMany({
      where: { accountType: type, accountId: id },
    });
    return rows.reduce(
      (sum, row) =>
        row.direction === 'credit'
          ? sum + row.amountFcfa
          : sum - row.amountFcfa,
      0,
    );
  }

  private lockBrand(tx: Prisma.TransactionClient, id: string) {
    return tx.$queryRaw`SELECT id FROM brands WHERE id = ${id} FOR UPDATE`;
  }

  private lockEscrow(tx: Prisma.TransactionClient, campaignId: string) {
    return tx.$queryRaw`SELECT campaign_id FROM escrow_holds WHERE campaign_id = ${campaignId} FOR UPDATE`;
  }

  private async lockWallet(tx: Prisma.TransactionClient, influencerId: string) {
    await tx.wallet.upsert({
      where: { influencerId },
      create: { influencerId, availableFcfa: 0 },
      update: {},
    });
    await tx.$queryRaw`SELECT influencer_id FROM wallets WHERE influencer_id = ${influencerId} FOR UPDATE`;
  }
}
