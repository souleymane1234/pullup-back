import { COMMISSION, PLANS, type PlanKey } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';
import { commissionOf, netAfterCommission } from '../../../common/money.js';

export function splitOffer(price: number) {
  const amount = price;
  const fee = commissionOf(amount, COMMISSION);
  const payout = netAfterCommission(amount, COMMISSION);
  return { amount, fee, payout };
}

export function paymentSplit(balance: number, amount: number) {
  const fromBalance = Math.min(Math.max(0, balance), amount);
  return { fromBalance, toCollect: amount - fromBalance };
}

export function assertQuota(plan: PlanKey, usedThisMonth: number): void {
  const limit = PLANS[plan].monthlyCampaigns;
  if (Number.isFinite(limit) && usedThisMonth >= limit) {
    throw new AppError('Quota de campagnes atteint pour votre formule.', 403);
  }
}
