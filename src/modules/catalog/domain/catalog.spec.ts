import { afterEach, describe, expect, it } from 'vitest';
import {
  catalogLiveFromRecords,
  resetCatalogLive,
  setCatalogLive,
} from '../../../common/catalog-live.js';
import { selectedCats } from '../../auth/domain/signup.js';
import {
  assertCatalogKey,
  catalogCreatedMessage,
  defaultCatalogRecords,
  groupCatalogAdmin,
  presentCatalogItem,
  resolveCatalogKey,
  slugFromLabel,
} from './catalog.js';

describe('catalogue métier', () => {
  afterEach(() => {
    resetCatalogLive();
  });

  it('seed les 11 thématiques, 6 villes, 4 objectifs et 3 types de demande', () => {
    const records = defaultCatalogRecords();
    expect(records.filter((item) => item.kind === 'category')).toHaveLength(11);
    expect(records.filter((item) => item.kind === 'city')).toHaveLength(6);
    expect(records.filter((item) => item.kind === 'objective')).toHaveLength(4);
    expect(records.filter((item) => item.kind === 'contact_type')).toHaveLength(
      3,
    );
    expect(records.find((item) => item.key === 'beaute')?.label).toBe(
      'Mode & beauté',
    );
  });

  it('dérive une clé minuscule depuis un libellé', () => {
    expect(slugFromLabel('Cinéma & séries')).toBe('cinema_series');
    expect(resolveCatalogKey('city', undefined, 'Grand-Bassam')).toBe(
      'Grand-Bassam',
    );
    expect(() => assertCatalogKey('category', 'Cinéma')).toThrow(/minuscules/);
  });

  it('prend en compte une catégorie créée par l’admin', () => {
    const records = [
      ...defaultCatalogRecords(),
      {
        kind: 'category' as const,
        key: 'cinema',
        label: 'Cinéma & séries',
        related: ['actu'],
        reco: null,
        sortOrder: 20,
        active: true,
      },
    ];
    setCatalogLive(catalogLiveFromRecords(records));
    expect(selectedCats(['cinema'])).toEqual(['cinema']);
    expect(presentCatalogItem(records[records.length - 1]!).label).toBe(
      'Cinéma & séries',
    );
    expect(
      groupCatalogAdmin(records).categories.some(
        (item) => item.key === 'cinema',
      ),
    ).toBe(true);
  });

  it('rédige les messages de création', () => {
    expect(catalogCreatedMessage('category')).toBe('Catégorie créée.');
    expect(catalogCreatedMessage('city')).toBe('Ville créée.');
  });
});
