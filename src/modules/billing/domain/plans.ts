import { PLANS, type PlanKey } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';

export const UNKNOWN_PLAN = 'Formule inconnue.';
export const AWAITING_PAYMENT = 'Confirmez le paiement sur votre téléphone.';
export const PLAN_PERIOD_DAYS = 30;
export const RENEWAL_NOTICE_DAYS = 3;
export const GRACE_DAYS = 3;

export type PaidPlan = Exclude<PlanKey, 'free'>;

export function assertPlan(value: unknown): PlanKey {
  if (typeof value !== 'string' || !(value in PLANS)) {
    throw new AppError(UNKNOWN_PLAN, 422);
  }
  return value as PlanKey;
}

export function planLabel(plan: PlanKey): string {
  return PLANS[plan].l;
}

export function planPrice(plan: PlanKey): number {
  return PLANS[plan].p;
}

export function activatedMessage(plan: PaidPlan): string {
  return `Formule ${planLabel(plan)} activée.`;
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

export function periodOf(from = new Date(), days = PLAN_PERIOD_DAYS) {
  return { start: from, end: addDays(from, days) };
}
