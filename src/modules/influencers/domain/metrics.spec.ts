import {
  avgEngagement,
  badge,
  isListed,
  pullupScore,
  totalFollowers,
} from './metrics.js';

/** Profil Ama Kouassi du seed front. */
const ama = {
  net: { ig: [412000, 5.8], tt: [268000, 7.4], fb: [96000, 2.1] } as Record<
    string,
    [number, number]
  >,
  rates: [
    { net: 'ig', price: 35000 },
    { net: 'ig', price: 90000 },
    { net: 'tt', price: 120000 },
    { net: 'ig', price: 25000 },
  ],
  auth: 94,
  creat: 4.6,
  brief: 96,
  onTime: 98,
  verified: true,
  status: 'active',
};

describe('métriques influenceur', () => {
  it('reproduit les chiffres d’Ama Kouassi', () => {
    expect(totalFollowers(ama)).toBe(776000);
    expect(avgEngagement(ama)).toBeCloseTo(5.894845, 5);
    expect(badge(ama).k).toBe('macro');
    expect(pullupScore(ama)).toBe(4.6);
    expect(isListed(ama)).toBe(true);
  });

  it('classe un profil à 200k+ en montée', () => {
    expect(badge({ net: { ig: [210000, 3] } }).k).toBe('montee');
  });
});
