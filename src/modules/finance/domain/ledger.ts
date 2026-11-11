import { randomUUID } from 'node:crypto';
import { AppError } from '../../../common/http/app.error.js';
import { fcfaPositive } from '../../../common/money.js';

export type LedgerAccount =
  | 'brand_balance'
  | 'escrow'
  | 'influencer_wallet'
  | 'platform_revenue'
  | 'external_psp';
export type LedgerDirection = 'debit' | 'credit';

export interface CampaignMoney {
  id: string;
  brandId: string;
  influencerId: string;
  amount: number;
  fee: number;
  payout: number;
  ref?: string;
}

export interface LedgerLine {
  txId: string;
  accountType: LedgerAccount;
  accountId: string | null;
  campaignId: string | null;
  direction: LedgerDirection;
  amountFcfa: number;
  label: string;
}

export interface LedgerBalances {
  brands: Map<string, number>;
  wallets: Map<string, number>;
}

export function newTxId(): string {
  return randomUUID();
}

export function transfer(
  txId: string,
  from: { type: LedgerAccount; id: string | null },
  to: { type: LedgerAccount; id: string | null },
  amount: number,
  label: string,
  campaignId: string | null = null,
): LedgerLine[] {
  const value = fcfaPositive(amount);
  return [
    {
      txId,
      accountType: from.type,
      accountId: from.id,
      campaignId,
      direction: 'debit',
      amountFcfa: value,
      label,
    },
    {
      txId,
      accountType: to.type,
      accountId: to.id,
      campaignId,
      direction: 'credit',
      amountFcfa: value,
      label,
    },
  ];
}

export function assertBalanced(lines: LedgerLine[]): void {
  const byTx = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (line.amountFcfa <= 0) {
      throw new AppError('Le montant doit être un entier en FCFA.', 422);
    }
    const bucket = byTx.get(line.txId) ?? { debit: 0, credit: 0 };
    bucket[line.direction] += line.amountFcfa;
    byTx.set(line.txId, bucket);
  }
  for (const [txId, sums] of byTx) {
    if (sums.debit !== sums.credit) {
      throw new AppError(`Écriture ${txId} non équilibrée.`, 500);
    }
  }
}

export function applySigned(
  current: number,
  direction: LedgerDirection,
  amount: number,
): number {
  const next = direction === 'credit' ? current + amount : current - amount;
  if (next < 0) {
    throw new AppError('Solde insuffisant.', 422);
  }
  return next;
}

export function assertCampaignSplit(campaign: CampaignMoney): void {
  if (campaign.fee + campaign.payout !== campaign.amount) {
    throw new AppError('Le montant de campagne est incohérent.', 422);
  }
  fcfaPositive(campaign.amount);
  fcfaPositive(campaign.payout);
}

export function collectToEscrowLines(
  campaign: CampaignMoney,
  amountPsp: number,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'external_psp', id: 'psp' },
    { type: 'escrow', id: campaign.id },
    amountPsp,
    `Encaissement campagne ${campaign.id}`,
    campaign.id,
  );
}

export function balanceToEscrowLines(
  brandId: string,
  campaign: CampaignMoney,
  amount: number,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'brand_balance', id: brandId },
    { type: 'escrow', id: campaign.id },
    amount,
    `Solde vers séquestre ${campaign.id}`,
    campaign.id,
  );
}

export function releaseEscrowLines(campaign: CampaignMoney): LedgerLine[] {
  assertCampaignSplit(campaign);
  const txId = newTxId();
  return [
    ...transfer(
      txId,
      { type: 'escrow', id: campaign.id },
      { type: 'influencer_wallet', id: campaign.influencerId },
      campaign.payout,
      campaign.ref
        ? `Campagne ${campaign.ref} libérée`
        : `Libération influenceur ${campaign.id}`,
      campaign.id,
    ),
    ...transfer(
      txId,
      { type: 'escrow', id: campaign.id },
      { type: 'platform_revenue', id: 'pullup' },
      campaign.fee,
      `Commission ${campaign.id}`,
      campaign.id,
    ),
  ];
}

export function escrowToBrandLines(
  campaign: CampaignMoney,
  amount: number,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'escrow', id: campaign.id },
    { type: 'brand_balance', id: campaign.brandId },
    amount,
    `Remboursement solde ${campaign.id}`,
    campaign.id,
  );
}

export function refundEscrowLines(campaign: CampaignMoney): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'escrow', id: campaign.id },
    { type: 'brand_balance', id: campaign.brandId },
    campaign.amount,
    `Remboursement ${campaign.id}`,
    campaign.id,
  );
}

export function walletToPayoutLines(
  influencerId: string,
  amount: number,
  label: string,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'influencer_wallet', id: influencerId },
    { type: 'external_psp', id: 'psp' },
    amount,
    label,
  );
}

export function payoutFailedLines(
  influencerId: string,
  amount: number,
  label: string,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'external_psp', id: 'psp' },
    { type: 'influencer_wallet', id: influencerId },
    amount,
    label,
  );
}

export function collectRevenueLines(
  purpose: string,
  amount: number,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'external_psp', id: 'psp' },
    { type: 'platform_revenue', id: 'pullup' },
    amount,
    `Revenu ${purpose}`,
  );
}

export function balanceToRevenueLines(
  brandId: string,
  amount: number,
  label: string,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'brand_balance', id: brandId },
    { type: 'platform_revenue', id: 'pullup' },
    amount,
    label,
  );
}

export function brandCreditLines(
  brandId: string,
  amount: number,
  label: string,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'platform_revenue', id: 'pullup' },
    { type: 'brand_balance', id: brandId },
    amount,
    label,
  );
}

export function revenueToBrandLines(
  brandId: string,
  amount: number,
  label: string,
): LedgerLine[] {
  const txId = newTxId();
  return transfer(
    txId,
    { type: 'platform_revenue', id: 'pullup' },
    { type: 'brand_balance', id: brandId },
    amount,
    label,
  );
}
