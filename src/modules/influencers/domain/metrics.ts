import { catalogLive } from '../../../common/catalog-live.js';
import type { NetMap, RateJson } from './types.js';

export type { NetMap };

export interface MetricInfluencer {
  net: NetMap;
  rates: Array<
    Pick<RateJson, 'net' | 'price'> & { archivedAt?: string | null }
  >;
  auth: number;
  creat: number;
  brief: number;
  onTime: number;
  verified: boolean;
  status: string;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function totalFollowers(influencer: { net: NetMap }): number {
  return Object.values(influencer.net).reduce(
    (sum, network) => sum + network[0],
    0,
  );
}

export function avgEngagement(influencer: { net: NetMap }): number {
  const networks = Object.values(influencer.net);
  const total = totalFollowers(influencer);
  if (!total) {
    return 0;
  }
  return (
    networks.reduce((sum, network) => sum + network[1] * network[0], 0) / total
  );
}

export function minPrice(
  influencer: {
    rates: Array<{ net: string; price: number; archivedAt?: string | null }>;
  },
  net?: string,
): number {
  const prices = influencer.rates
    .filter((rate) => !rate.archivedAt)
    .filter((rate) => !net || net === 'any' || rate.net === net)
    .map((rate) => rate.price);
  return Math.min(...prices, Infinity);
}

export function badge(influencer: { net: NetMap }) {
  const total = totalFollowers(influencer);
  const engagement = avgEngagement(influencer);
  if (total >= 600_000 && engagement >= 4) {
    return { k: 'macro' as const, l: 'Macro influenceur', tone: 'ok' };
  }
  if (total >= 200_000) {
    return { k: 'montee' as const, l: 'Influenceur en montée', tone: 'warn' };
  }
  return { k: 'normal' as const, l: 'Influenceur', tone: 'orange' };
}

export function pullupScore(influencer: MetricInfluencer): number {
  const engagement = clamp(avgEngagement(influencer) / 7);
  const score =
    (engagement * 0.3 +
      (influencer.auth / 100) * 0.25 +
      (influencer.creat / 5) * 0.15 +
      (influencer.brief / 100) * 0.15 +
      (influencer.onTime / 100) * 0.15) *
    5;
  return Math.round(score * 10) / 10;
}

export function wordCount(text = ''): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function catLabel(key: string): string {
  return catalogLive().cats[key] ?? key;
}

export function isListed(influencer: {
  verified: boolean;
  status: string;
}): boolean {
  return Boolean(influencer.verified) && influencer.status === 'active';
}

export function derivedOf(influencer: MetricInfluencer) {
  const total = totalFollowers(influencer);
  const engagement = avgEngagement(influencer);
  const min = minPrice(influencer);
  return {
    totalFollowers: total,
    avgEngagement: Math.round(engagement * 100) / 100,
    minPrice: Number.isFinite(min) ? min : 0,
    badgeKey: badge(influencer).k,
    pullupScore: pullupScore(influencer),
  };
}
