import { BOOSTS } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';
import { addDays } from './plans.js';

export const UNKNOWN_BOOST = 'Option inconnue.';
export const BOOST_DAYS = 30;

export type BoostKey = keyof typeof BOOSTS;

export function resolveBoost(input: { key?: string; label?: string }): {
  key: BoostKey;
  label: string;
  price: number;
} {
  const byKey =
    input.key && input.key in BOOSTS ? (input.key as BoostKey) : null;
  const needle = (input.label ?? '').trim().toLowerCase();
  const byLabel = (
    Object.entries(BOOSTS) as Array<[BoostKey, (typeof BOOSTS)[BoostKey]]>
  ).find(([, boost]) => boost.l.toLowerCase() === needle)?.[0];
  const key = byKey ?? byLabel;
  if (!key) {
    throw new AppError(UNKNOWN_BOOST, 422);
  }
  return { key, label: BOOSTS[key].l, price: BOOSTS[key].p };
}

export function boostActivatedMessage(label: string): string {
  return `Option ${label} activée pour 30 jours.`;
}

export function boostPeriod(from = new Date()) {
  return { start: from, end: addDays(from, BOOST_DAYS) };
}
