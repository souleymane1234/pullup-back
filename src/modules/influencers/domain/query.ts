import {
  avgEngagement,
  badge,
  isListed,
  minPrice,
  pullupScore,
  totalFollowers,
} from './metrics.js';
import { matchesSearch } from './search.js';
import type { InfluencerRecord } from './present.js';

export interface ListParams {
  cursor: number;
  limit: number;
  s: string;
  cat: string;
  net: string;
  badge: string;
  budget: string | number;
  sort: 'score' | 'plus' | 'moins' | 'prix' | 'eng';
}

const SORTERS: Record<
  ListParams['sort'],
  (a: InfluencerRecord, b: InfluencerRecord) => number
> = {
  score: (a, b) =>
    Number(Boolean(b.featured)) - Number(Boolean(a.featured)) ||
    Number(Boolean(b.certified)) - Number(Boolean(a.certified)) ||
    pullupScore(b) - pullupScore(a),
  plus: (a, b) => totalFollowers(b) - totalFollowers(a),
  moins: (a, b) => totalFollowers(a) - totalFollowers(b),
  prix: (a, b) => minPrice(a) - minPrice(b),
  eng: (a, b) => avgEngagement(b) - avgEngagement(a),
};

export function listedOf(items: InfluencerRecord[]): InfluencerRecord[] {
  return items.filter(isListed);
}

export function filterListed(
  items: InfluencerRecord[],
  params: ListParams,
): InfluencerRecord[] {
  let list = listedOf(items);
  if (params.s.trim()) {
    list = list.filter((influencer) => matchesSearch(influencer, params.s));
  }
  if (params.cat) {
    list = list.filter((influencer) => influencer.cats.includes(params.cat));
  }
  if (params.net) {
    list = list.filter((influencer) => Boolean(influencer.net[params.net]));
  }
  if (params.badge) {
    list = list.filter((influencer) => badge(influencer).k === params.badge);
  }
  if (
    params.budget !== '' &&
    params.budget !== undefined &&
    params.budget !== null
  ) {
    const budget = Number(params.budget);
    if (Number.isFinite(budget)) {
      list = list.filter(
        (influencer) => minPrice(influencer, params.net || undefined) <= budget,
      );
    }
  }
  return [...list].sort(SORTERS[params.sort] ?? SORTERS.score);
}

export function carouselOf(
  items: InfluencerRecord[],
  filter: string,
  extras: { themes: Set<string>; favorites: Set<string>; used: Set<string> },
): InfluencerRecord[] {
  const list = listedOf(items);
  if (filter === 'montee') {
    return list
      .filter((influencer) => badge(influencer).k === 'montee')
      .sort((a, b) => avgEngagement(b) - avgEngagement(a));
  }
  if (filter && filter !== 'reco') {
    return list
      .filter((influencer) => influencer.cats.includes(filter))
      .sort((a, b) => pullupScore(b) - pullupScore(a));
  }
  const weight = (influencer: InfluencerRecord) =>
    pullupScore(influencer) +
    Math.log10(Math.max(1, totalFollowers(influencer))) * 0.35 +
    (influencer.cats.some((cat) => extras.themes.has(cat)) ? 0.6 : 0) +
    (influencer.featured ? 0.8 : 0) +
    (influencer.certified ? 0.5 : 0) +
    (extras.favorites.has(influencer.id) ? 0.4 : 0) -
    (extras.used.has(influencer.id) ? 0.3 : 0);
  return [...list].sort((a, b) => weight(b) - weight(a)).slice(0, 12);
}

export function canSeeProfile(
  influencer: { id: string; verified: boolean; status: string } | null,
  auth: { role: string; profileId: string } | undefined,
): boolean {
  if (!influencer) {
    return false;
  }
  const own = auth?.role === 'influencer' && auth.profileId === influencer.id;
  return isListed(influencer) || own || auth?.role === 'admin';
}
