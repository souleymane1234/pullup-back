import { AppError } from '../../../common/http/app.error.js';
import { assertVitrine, mergeRates } from './vitrine.js';

describe('vitrine', () => {
  it('refuse une vitrine sans catégorie ou sans tarif', () => {
    expect(() =>
      assertVitrine({
        cats: [],
        days: [],
        rates: [{ net: 'ig', fmt: 'Story', price: 8000 }],
      }),
    ).toThrow(AppError);
    expect(() =>
      assertVitrine({ cats: ['beaute'], days: [], rates: [] }),
    ).toThrow(AppError);
    expect(() =>
      assertVitrine({
        cats: ['beaute'],
        days: [],
        rates: [{ net: 'ig', fmt: '', price: 8000 }],
      }),
    ).toThrow(/5 000/);
  });

  it('archive les tarifs absents au lieu de les supprimer', () => {
    const existing = [
      { id: 'r1', net: 'ig', fmt: 'Story', price: 35000 },
      { id: 'r2', net: 'tt', fmt: 'Vidéo', price: 90000 },
    ];
    const merged = mergeRates(
      existing,
      [{ id: 'r1', net: 'ig', fmt: 'Story', price: 40000.4 }],
      new Date('2026-10-04'),
    );
    expect(merged).toEqual([
      { id: 'r1', net: 'ig', fmt: 'Story', price: 40000, archivedAt: null },
      {
        id: 'r2',
        net: 'tt',
        fmt: 'Vidéo',
        price: 90000,
        archivedAt: '2026-10-04T00:00:00.000Z',
      },
    ]);
  });
});
