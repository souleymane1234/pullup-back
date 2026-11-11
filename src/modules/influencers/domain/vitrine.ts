import { MIN_RATE } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';
import type { RateJson } from './types.js';

export interface VitrineInput {
  bio?: string;
  cats: string[];
  days: string[];
  rates: Array<{ id?: string; net: string; fmt: string; price: number }>;
}

export function assertVitrine(input: VitrineInput): void {
  if (!input.cats.length) {
    throw new AppError('Choisissez au moins une catégorie.', 422);
  }
  if (!input.rates.length) {
    throw new AppError('Gardez au moins un tarif.', 422);
  }
  if (
    input.rates.some(
      (rate) => !String(rate.fmt ?? '').trim() || Number(rate.price) < MIN_RATE,
    )
  ) {
    throw new AppError(
      'Chaque tarif doit avoir un format et coûter au moins 5 000 FCFA.',
      422,
    );
  }
}

export function mergeRates(
  existing: RateJson[],
  incoming: VitrineInput['rates'],
  now = new Date(),
): RateJson[] {
  const keptIds = new Set(incoming.map((rate) => rate.id).filter(Boolean));
  const archived = existing
    .filter((rate) => rate.id && !keptIds.has(rate.id) && !rate.archivedAt)
    .map((rate) => ({ ...rate, archivedAt: now.toISOString() }));
  const alreadyArchived = existing.filter(
    (rate) => rate.archivedAt && !keptIds.has(rate.id),
  );
  const next = incoming.map((rate, index) => ({
    id: rate.id || `r${now.getTime().toString(36)}${index}`,
    net: rate.net,
    fmt: rate.fmt.trim(),
    price: Math.round(Number(rate.price)),
    archivedAt: null,
  }));
  return [...next, ...archived, ...alreadyArchived];
}
