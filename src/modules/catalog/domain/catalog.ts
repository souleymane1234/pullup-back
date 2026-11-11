import {
  CATS,
  CITIES,
  CONTACT_TYPES,
  OBJ,
  RELATED,
  RECO_BY_OBJECTIVE,
  type CatKey,
} from '../../../common/catalog.js';
import {
  CATALOG_KINDS,
  type CatalogKind,
  type CatalogLive,
  type CatalogRecord,
} from '../../../common/catalog-live.js';
import { AppError } from '../../../common/http/app.error.js';

export { CATALOG_KINDS };
export type { CatalogKind, CatalogLive, CatalogRecord };

const SLUG = /^[a-z][a-z0-9_]{1,31}$/;
const FREE_KEY = /^[\p{L}\p{N}][\p{L}\p{N} '&._-]{0,63}$/u;

export function isCatalogKind(value: string): value is CatalogKind {
  return (CATALOG_KINDS as readonly string[]).includes(value);
}

export function assertCatalogKind(value: string): CatalogKind {
  if (!isCatalogKind(value)) {
    throw new AppError("Type d'élément inconnu.", 400);
  }
  return value;
}

export function slugFromLabel(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  if (!SLUG.test(slug)) {
    throw new AppError('Impossible de dériver une clé depuis ce libellé.', 400);
  }
  return slug;
}

export function assertCatalogKey(kind: CatalogKind, key: string): string {
  const trimmed = key.trim();
  if (kind === 'category' || kind === 'objective') {
    if (!SLUG.test(trimmed)) {
      throw new AppError(
        'La clé doit être en minuscules (lettres, chiffres, _), 2 à 32 caractères.',
        400,
      );
    }
    return trimmed;
  }
  if (!FREE_KEY.test(trimmed)) {
    throw new AppError('Indiquez un libellé valide.', 400);
  }
  return trimmed;
}

export function resolveCatalogKey(
  kind: CatalogKind,
  key: string | undefined,
  label: string,
): string {
  const raw = (key ?? '').trim();
  if (raw) {
    return assertCatalogKey(kind, raw);
  }
  if (kind === 'category' || kind === 'objective') {
    return slugFromLabel(label);
  }
  return assertCatalogKey(kind, label);
}

export function catalogCreatedMessage(kind: CatalogKind): string {
  switch (kind) {
    case 'category':
      return 'Catégorie créée.';
    case 'city':
      return 'Ville créée.';
    case 'objective':
      return 'Objectif créé.';
    case 'contact_type':
      return 'Type de demande créé.';
  }
}

export function catalogUpdatedMessage(kind: CatalogKind): string {
  switch (kind) {
    case 'category':
      return 'Catégorie mise à jour.';
    case 'city':
      return 'Ville mise à jour.';
    case 'objective':
      return 'Objectif mis à jour.';
    case 'contact_type':
      return 'Type de demande mis à jour.';
  }
}

export function catalogHiddenMessage(kind: CatalogKind): string {
  switch (kind) {
    case 'category':
      return 'Catégorie masquée.';
    case 'city':
      return 'Ville masquée.';
    case 'objective':
      return 'Objectif masqué.';
    case 'contact_type':
      return 'Type de demande masqué.';
  }
}

export function presentCatalogPublic(live: CatalogLive) {
  return {
    cats: live.cats,
    related: live.related,
    cities: live.cities,
    obj: live.obj,
    reco: live.reco,
    contactTypes: live.contactTypes,
  };
}

export function presentCatalogItem(item: CatalogRecord) {
  return {
    kind: item.kind,
    key: item.key,
    label: item.label,
    related: item.kind === 'category' ? item.related : undefined,
    reco: item.kind === 'objective' ? item.reco : undefined,
    sortOrder: item.sortOrder,
    active: item.active,
  };
}

export function groupCatalogAdmin(items: CatalogRecord[]) {
  return {
    categories: items
      .filter((item) => item.kind === 'category')
      .map(presentCatalogItem),
    cities: items
      .filter((item) => item.kind === 'city')
      .map(presentCatalogItem),
    objectives: items
      .filter((item) => item.kind === 'objective')
      .map(presentCatalogItem),
    contactTypes: items
      .filter((item) => item.kind === 'contact_type')
      .map(presentCatalogItem),
  };
}

export function defaultCatalogRecords(): CatalogRecord[] {
  const categories = Object.entries(CATS).map(([key, label], index) => ({
    kind: 'category' as const,
    key,
    label,
    related: [...(RELATED[key as CatKey] ?? [])],
    reco: null,
    sortOrder: index,
    active: true,
  }));
  const cities = CITIES.map((label, index) => ({
    kind: 'city' as const,
    key: label,
    label,
    related: [] as string[],
    reco: null,
    sortOrder: index,
    active: true,
  }));
  const objectives = Object.entries(OBJ).map(([key, label], index) => ({
    kind: 'objective' as const,
    key,
    label,
    related: [] as string[],
    reco: RECO_BY_OBJECTIVE[key as keyof typeof RECO_BY_OBJECTIVE] ?? null,
    sortOrder: index,
    active: true,
  }));
  const contactTypes = CONTACT_TYPES.map((label, index) => ({
    kind: 'contact_type' as const,
    key: label,
    label,
    related: [] as string[],
    reco: null,
    sortOrder: index,
    active: true,
  }));
  return [...categories, ...cities, ...objectives, ...contactTypes];
}

export function metaOf(item: Pick<CatalogRecord, 'kind' | 'related' | 'reco'>) {
  if (item.kind === 'category') {
    return { related: item.related };
  }
  if (item.kind === 'objective') {
    return { reco: item.reco };
  }
  return {};
}

export function recordFromRow(row: {
  kind: CatalogKind;
  key: string;
  label: string;
  meta: unknown;
  sortOrder: number;
  active: boolean;
}): CatalogRecord {
  const meta =
    row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)
      ? (row.meta as { related?: unknown; reco?: unknown })
      : {};
  const related = Array.isArray(meta.related)
    ? meta.related.filter((value): value is string => typeof value === 'string')
    : [];
  const reco = typeof meta.reco === 'string' ? meta.reco : null;
  return {
    kind: row.kind,
    key: row.key,
    label: row.label,
    related,
    reco,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}
