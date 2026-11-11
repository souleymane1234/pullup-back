import { afterEach, describe, expect, it } from 'vitest';
import { CATS, CITIES } from './catalog.js';
import {
  catalogLive,
  catalogLiveFromRecords,
  resetCatalogLive,
} from './catalog-live.js';

describe('catalogue vivant', () => {
  afterEach(() => {
    resetCatalogLive();
  });

  it('retombe sur les constantes tant que la base est vide', () => {
    expect(catalogLive().cats).toEqual({ ...CATS });
    expect(catalogLive().cities).toEqual([...CITIES]);
    expect(catalogLiveFromRecords([]).cats.beaute).toBe('Mode & beauté');
  });

  it('ignore une catégorie masquée', () => {
    const live = catalogLiveFromRecords([
      {
        kind: 'category',
        key: 'cinema',
        label: 'Cinéma',
        related: [],
        reco: null,
        sortOrder: 0,
        active: true,
      },
      {
        kind: 'category',
        key: 'beaute',
        label: 'Mode & beauté',
        related: [],
        reco: null,
        sortOrder: 1,
        active: false,
      },
    ]);
    expect(live.cats).toEqual({ cinema: 'Cinéma' });
    expect(live.cats.beaute).toBeUndefined();
  });
});
