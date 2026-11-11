import { MIN_RATE, NET, type NetKey } from '../../../common/catalog.js';
import { catalogLive } from '../../../common/catalog-live.js';
import { AppError } from '../../../common/http/app.error.js';
import { fcfa } from '../../../common/money.js';

export const DEFAULT_BIO =
  'Nouveau sur PULLUP. Présentez votre univers depuis votre espace.';

export function dedicacePrice(base: number): number {
  const rounded = Math.round((fcfa(base) * 0.6) / 500) * 500;
  return Math.max(MIN_RATE, rounded);
}

export function parseFollowerCount(value: unknown): number {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    return 0;
  }
  return Math.floor(n);
}

export function selectedNets(
  nets: Record<string, unknown>,
): Array<[NetKey, number]> {
  const selected = (Object.keys(NET) as NetKey[])
    .map((key) => [key, parseFollowerCount(nets[key])] as [NetKey, number])
    .filter(([, count]) => count > 0);
  if (selected.length < 1) {
    throw new AppError('Indiquez au moins un réseau avec des abonnés.', 422);
  }
  return selected;
}

export function selectedCats(cats: string[]): string[] {
  const unique = [...new Set(cats)];
  if (unique.length < 1 || unique.length > 3) {
    throw new AppError('Choisissez entre 1 et 3 thématiques.', 422);
  }
  const known = catalogLive().cats;
  for (const key of unique) {
    if (!(key in known)) {
      throw new AppError('Thématique inconnue.', 422);
    }
  }
  return unique;
}

export function resolveCity(city: string): string {
  const trimmed = city.trim();
  const cities = catalogLive().cities;
  const fallback = cities[0] ?? 'Abidjan';
  if (trimmed === 'Autre' || !trimmed) {
    return fallback;
  }
  return trimmed;
}

/** Audience vide : pas de géo / âge / genre tant qu'ils ne sont pas mesurés. */
export function emptyAudience() {
  return {
    f: 0,
    ages: [] as number[],
    cities: [] as Array<[string, number]>,
  };
}

/** @deprecated préférer emptyAudience — plus de répartition fictive à l'inscription. */
export function buildAudience(_city?: string) {
  return emptyAudience();
}

export function buildRates(firstNet: NetKey, price: number, dedicace: boolean) {
  const base = fcfa(price);
  if (base < MIN_RATE) {
    throw new AppError('Prix minimum 5 000 FCFA.', 422);
  }
  const rates = [{ net: firstNet, fmt: 'Story / post', price: base }];
  if (dedicace) {
    rates.push({
      net: firstNet,
      fmt: 'Dédicace vidéo',
      price: dedicacePrice(base),
    });
  }
  return rates;
}

export function randomHue(): number {
  return Math.floor(Math.random() * 360);
}
