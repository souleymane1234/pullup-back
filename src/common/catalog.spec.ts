import {
  AUTO_VALIDATE_HOURS,
  CITIES,
  COMMISSION,
  HELD_STATUSES,
  MAX_BRIEF_WORDS,
  MIN_RATE,
  PLANS,
  RECO_BY_OBJECTIVE,
  WITHDRAW_OPERATORS,
} from './catalog.js';

describe('catalog', () => {
  it('fixe la commission à 15 % et le tarif plancher à 5 000 FCFA', () => {
    expect(COMMISSION).toBe(0.15);
    expect(MIN_RATE).toBe(5000);
    expect(MAX_BRIEF_WORDS).toBe(160);
    expect(AUTO_VALIDATE_HOURS).toBe(72);
    expect(CITIES).toContain('Abidjan');
    expect(HELD_STATUSES).toEqual(['paid', 'accepted', 'published', 'dispute']);
  });

  it('exprime les prix de formules en entiers FCFA', () => {
    expect(Number.isInteger(PLANS.pro.p)).toBe(true);
    expect(PLANS.business.p).toBe(75000);
    expect(PLANS.free.exportCsv).toBe(false);
    expect(PLANS.business.exportCsv).toBe(true);
    expect(PLANS.pro.fullMatching).toBe(true);
  });

  it('n’autorise pas la carte pour un retrait', () => {
    expect(WITHDRAW_OPERATORS).not.toContain('card');
  });

  it('associe chaque objectif à une recommandation de matching', () => {
    expect(RECO_BY_OBJECTIVE.notoriete).toBe('Campagnes de notoriété');
    expect(RECO_BY_OBJECTIVE.conversion).toBe('Lancements de produits');
  });
});
