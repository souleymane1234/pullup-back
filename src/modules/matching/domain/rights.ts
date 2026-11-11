import { PLANS, type PlanKey } from '../../../common/catalog.js';
import type { MatchResult } from './matching.js';

export type MatchPlan = PlanKey | null;

export type PublicMatch = Omit<
  MatchResult,
  'influencer' | 'reach' | 'interactions' | 'cpm' | 'price'
> & {
  influencer:
    | MatchResult['influencer']
    | { id: string; name: string; hue: number; cats: string[] };
  reach: number | null;
  interactions: number | null;
  cpm: number | null;
  price: number | null;
  masked?: boolean;
};

export function applyMatchingRights(
  results: MatchResult[],
  plan: MatchPlan,
): PublicMatch[] {
  const rights = plan
    ? PLANS[plan]
    : { fullMatching: false, predictions: false };
  return results.map((match, index) => {
    const visible = rights.fullMatching || index < 3;
    if (!visible) {
      return {
        ...match,
        influencer: {
          id: `masked-${index + 1}`,
          name: 'Profil réservé',
          hue: match.influencer.hue,
          cats: match.influencer.cats,
        },
        price: null,
        reach: null,
        interactions: null,
        cpm: null,
        masked: true,
      };
    }
    if (!rights.predictions) {
      return { ...match, reach: null, interactions: null, cpm: null };
    }
    return match;
  });
}
