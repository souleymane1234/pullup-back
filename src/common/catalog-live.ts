import {
  CATS,
  CITIES,
  CONTACT_TYPES,
  OBJ,
  RELATED,
  RECO_BY_OBJECTIVE,
} from './catalog.js';

export const CATALOG_KINDS = [
  'category',
  'city',
  'objective',
  'contact_type',
] as const;

export type CatalogKind = (typeof CATALOG_KINDS)[number];

export type CatalogRecord = {
  kind: CatalogKind;
  key: string;
  label: string;
  related: string[];
  reco: string | null;
  sortOrder: number;
  active: boolean;
};

export type CatalogLive = {
  cats: Record<string, string>;
  related: Record<string, string[]>;
  cities: string[];
  obj: Record<string, string>;
  reco: Record<string, string>;
  contactTypes: string[];
};

export function staticCatalogLive(): CatalogLive {
  return {
    cats: { ...CATS },
    related: Object.fromEntries(
      Object.entries(RELATED).map(([key, value]) => [key, [...value]]),
    ),
    cities: [...CITIES],
    obj: { ...OBJ },
    reco: { ...RECO_BY_OBJECTIVE },
    contactTypes: [...CONTACT_TYPES],
  };
}

let live: CatalogLive = staticCatalogLive();

export function catalogLive(): CatalogLive {
  return live;
}

export function setCatalogLive(next: CatalogLive): void {
  live = next;
}

export function resetCatalogLive(): void {
  live = staticCatalogLive();
}

export function catalogLiveFromRecords(records: CatalogRecord[]): CatalogLive {
  const fallback = staticCatalogLive();
  const cats: Record<string, string> = {};
  const related: Record<string, string[]> = {};
  const cities: string[] = [];
  const obj: Record<string, string> = {};
  const reco: Record<string, string> = {};
  const contactTypes: string[] = [];
  const active = [...records]
    .filter((item) => item.active)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.key.localeCompare(right.key, 'fr'),
    );

  for (const item of active) {
    if (item.kind === 'category') {
      cats[item.key] = item.label;
      related[item.key] = [...item.related];
    } else if (item.kind === 'city') {
      cities.push(item.label);
    } else if (item.kind === 'objective') {
      obj[item.key] = item.label;
      if (item.reco) {
        reco[item.key] = item.reco;
      }
    } else {
      contactTypes.push(item.label);
    }
  }

  const hasKind = (kind: CatalogKind) =>
    records.some((item) => item.kind === kind);

  return {
    cats: hasKind('category') ? cats : fallback.cats,
    related: hasKind('category') ? related : fallback.related,
    cities: hasKind('city') ? cities : fallback.cities,
    obj: hasKind('objective') ? obj : fallback.obj,
    reco: hasKind('objective') ? reco : fallback.reco,
    contactTypes: hasKind('contact_type')
      ? contactTypes
      : fallback.contactTypes,
  };
}
