import {
  buildAudience,
  buildRates,
  dedicacePrice,
  emptyAudience,
  selectedCats,
  selectedNets,
} from './signup.js';

describe('dedicacePrice', () => {
  it('arrondit à 500 FCFA avec un plancher à 5 000', () => {
    expect(dedicacePrice(15_000)).toBe(9_000);
    expect(dedicacePrice(6_000)).toBe(5_000);
  });
});

describe('selectedNets', () => {
  it('garde tous les réseaux avec des abonnés', () => {
    expect(selectedNets({ ig: 12000, tt: 0, fb: '', sc: '' })).toEqual([
      ['ig', 12000],
    ]);
    expect(selectedNets({ ig: 12000, tt: 8000, fb: 3000, sc: 1500 })).toEqual([
      ['ig', 12000],
      ['tt', 8000],
      ['fb', 3000],
      ['sc', 1500],
    ]);
    expect(() => selectedNets({ ig: 0, tt: 0, fb: 0, sc: 0 })).toThrow(
      /au moins un réseau/,
    );
  });
});

describe('selectedCats', () => {
  it('accepte 1 à 3 thématiques valides', () => {
    expect(selectedCats(['beaute'])).toEqual(['beaute']);
    expect(() => selectedCats([])).toThrow();
    expect(() => selectedCats(['inconnue'])).toThrow();
  });
});

describe('buildRates', () => {
  it('refuse un prix sous 5 000 FCFA', () => {
    expect(() => buildRates('ig', 4999, false)).toThrow(
      /Prix minimum 5 000 FCFA/,
    );
  });

  it('ajoute la dédicace à 60 % du prix', () => {
    expect(buildRates('ig', 15_000, true)).toEqual([
      { net: 'ig', fmt: 'Story / post', price: 15_000 },
      { net: 'ig', fmt: 'Dédicace vidéo', price: 9_000 },
    ]);
  });
});

describe('buildAudience', () => {
  it('ne fabrique plus de répartition fictive', () => {
    expect(buildAudience('Autre')).toEqual(emptyAudience());
    expect(buildAudience('Abidjan').cities).toEqual([]);
  });
});
