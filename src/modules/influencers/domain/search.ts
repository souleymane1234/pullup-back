import { catLabel } from './metrics.js';

export function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function matchesSearch(
  influencer: {
    name: string;
    handle: string;
    city: string;
    cats: string[];
    bio: string;
  },
  query: string,
): boolean {
  const needle = fold(query.trim());
  if (!needle) {
    return true;
  }
  const haystack = fold(
    `${influencer.name} ${influencer.handle} ${influencer.city} ${influencer.cats.map(catLabel).join(' ')} ${influencer.bio}`,
  );
  return haystack.includes(needle);
}
