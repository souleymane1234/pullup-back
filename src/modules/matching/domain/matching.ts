import { NET, type NetKey } from '../../../common/catalog.js';
import { catalogLive } from '../../../common/catalog-live.js';
import {
  avgEngagement,
  catLabel,
  clamp,
  isListed,
  minPrice,
} from '../../influencers/domain/metrics.js';
import type { InfluencerRecord } from '../../influencers/domain/present.js';

export interface MatchBrief {
  theme: string;
  objective: string;
  net: 'any' | NetKey;
  budget: number;
  age: '' | '0' | '1' | '2' | '3';
  gender: 'all' | 'f' | 'm';
  city: string;
}

export interface MatchResult {
  influencer: InfluencerRecord;
  s: number;
  note: number;
  reach: number;
  interactions: number;
  price: number;
  inBudget: boolean;
  why: string[];
  bestNet: NetKey;
  reco: string;
  cpm: number;
}

function formatPercent(value: number): string {
  return `${String(Math.round(Number(value) * 10) / 10).replace('.', ',')} %`;
}

export function matchOne(
  influencer: InfluencerRecord,
  brief: MatchBrief,
): MatchResult | null {
  if (brief.net !== 'any' && !influencer.net[brief.net]) {
    return null;
  }

  const related = catalogLive().related[brief.theme] ?? [];
  const themeScore = influencer.cats.includes(brief.theme)
    ? 1
    : related.some((cat) => influencer.cats.includes(cat))
      ? 0.55
      : 0.1;
  const engagement =
    brief.net === 'any'
      ? avgEngagement(influencer)
      : influencer.net[brief.net]![1];
  const engagementScore = clamp(engagement / 8);

  let fit = 1;
  if (brief.gender === 'f') {
    fit *= clamp((influencer.aud.f / 100) * 1.5);
  }
  if (brief.gender === 'm') {
    fit *= clamp(((100 - influencer.aud.f) / 100) * 1.5);
  }
  if (brief.age !== '') {
    fit *= clamp(influencer.aud.ages[Number(brief.age)] / 45 + 0.3);
  }
  let cityShare: number | null = null;
  if (brief.city) {
    const match = influencer.aud.cities.find(
      (entry) => entry[0] === brief.city,
    );
    cityShare = match ? match[1] : 3;
    fit *= clamp(cityShare / 55 + 0.3);
  }

  const audienceScore = (influencer.auth / 100) * clamp(fit);
  const historyScore = clamp(
    (influencer.rating / 5) * 0.5 +
      (influencer.onTime / 100) * 0.3 +
      clamp(influencer.done / 60) * 0.2,
  );
  const s =
    themeScore * 0.4 +
    engagementScore * 0.3 +
    audienceScore * 0.2 +
    historyScore * 0.1;
  const note = Math.round((3 + 2 * s) * 10) / 10;

  const followers =
    brief.net === 'any'
      ? Math.max(...Object.values(influencer.net).map((network) => network[0]))
      : influencer.net[brief.net]![0];
  const bestNet = (
    brief.net === 'any'
      ? Object.entries(influencer.net).sort((a, b) => b[1][0] - a[1][0])[0]![0]
      : brief.net
  ) as NetKey;
  const reach = Math.round(followers * NET[bestNet].reach * (0.75 + 0.5 * s));
  const interactions = Math.round(
    ((reach * engagement) / 100) * (0.85 + 0.3 * s),
  );
  const price = minPrice(influencer, brief.net);

  const why: string[] = [];
  if (themeScore === 1) {
    why.push(`Thématique alignée : ${catLabel(brief.theme)}`);
  } else if (themeScore > 0.5) {
    why.push(`Thématique proche (${influencer.cats.map(catLabel).join(', ')})`);
  }
  why.push(
    `Engagement de ${formatPercent(engagement)} ${brief.net === 'any' ? 'en moyenne' : `sur ${NET[brief.net].l}`}`,
  );
  if (cityShare !== null && cityShare >= 10) {
    why.push(`${cityShare} % de l'audience à ${brief.city}`);
  }
  if (brief.gender !== 'all') {
    const share =
      brief.gender === 'f' ? influencer.aud.f : 100 - influencer.aud.f;
    why.push(
      `${share} % d'audience ${brief.gender === 'f' ? 'féminine' : 'masculine'}`,
    );
  }
  why.push(
    `${influencer.onTime} % des campagnes publiées à l'heure, audience authentique à ${influencer.auth} %`,
  );

  return {
    influencer,
    s,
    note,
    reach,
    interactions,
    price,
    inBudget: price <= Number(brief.budget),
    why,
    bestNet,
    reco: catalogLive().reco[brief.objective] ?? '',
    cpm: (price / reach) * 1000,
  };
}

export function rankMatches(
  influencers: InfluencerRecord[],
  brief: MatchBrief,
): MatchResult[] {
  return influencers
    .filter(isListed)
    .map((influencer) => matchOne(influencer, brief))
    .filter((match): match is MatchResult => Boolean(match))
    .sort((a, b) => Number(b.inBudget) - Number(a.inBudget) || b.s - a.s);
}
