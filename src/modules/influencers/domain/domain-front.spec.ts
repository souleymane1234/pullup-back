import { COMMISSION } from '../../../common/catalog.js';
import { formatFcfa } from '../../../common/format.js';
import { commissionOf, netAfterCommission } from '../../../common/money.js';
import { seedInfluencerRecords } from '../../../../prisma/seed-influencers.js';
import { buildUtm } from '../../campaigns/domain/utm.js';
import { matchOne, rankMatches } from '../../matching/domain/matching.js';
import {
  avgEngagement,
  badge,
  minPrice,
  pullupScore,
  totalFollowers,
} from './metrics.js';
import type { InfluencerRecord } from './present.js';

const influencer = (
  patch: Partial<InfluencerRecord> = {},
): InfluencerRecord => ({
  id: 'x1',
  name: 'Test Créatrice',
  handle: 'test',
  verified: true,
  status: 'active',
  cats: ['beaute'],
  net: { ig: [100000, 5], tt: [200000, 7] },
  rates: [
    { id: 'r1', net: 'ig', fmt: 'Story', price: 30000 },
    { id: 'r2', net: 'tt', fmt: 'Vidéo', price: 60000 },
  ],
  aud: {
    f: 70,
    ages: [10, 45, 35, 10],
    cities: [
      ['Abidjan', 60],
      ['Bouaké', 10],
    ],
  },
  auth: 92,
  rating: 4.6,
  reviews: 20,
  onTime: 95,
  creat: 4.5,
  brief: 92,
  done: 30,
  days: ['Lun'],
  accepts: { pub: true, partenariat: true, dedicace: false },
  views: [],
  qr: 0,
  contacts: 0,
  hue: 1,
  photo: null,
  certified: false,
  city: 'Abidjan',
  bio: '',
  ...patch,
});

const brief = {
  theme: 'beaute',
  objective: 'notoriete' as const,
  net: 'any' as const,
  budget: 50000,
  age: '1' as const,
  gender: 'f' as const,
  city: 'Abidjan',
};

describe('domaine', () => {
  it('calcule abonnés et prix d’entrée', () => {
    expect(totalFollowers(influencer())).toBe(300000);
    expect(minPrice(influencer())).toBe(30000);
    expect(minPrice(influencer(), 'tt')).toBe(60000);
  });

  it('borne le Score PULLUP entre 0 et 5', () => {
    const score = pullupScore(influencer());
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(5);
  });

  it('attribue un badge avec un libellé', () => {
    const result = badge(influencer());
    expect(result).toHaveProperty('k');
    expect(result).toHaveProperty('l');
  });

  it('note la compatibilité entre 3 et 5 et explique le choix', () => {
    const match = matchOne(influencer(), brief);
    expect(match!.note).toBeGreaterThanOrEqual(3);
    expect(match!.note).toBeLessThanOrEqual(5);
    expect(match!.why[0]).toBe('Thématique alignée : Mode & beauté');
    expect(match!.inBudget).toBe(true);
  });

  it('exclut un profil absent du réseau demandé et classe ceux du budget en premier', () => {
    expect(matchOne(influencer(), { ...brief, net: 'fb' })).toBeNull();
    const cheap = influencer({ id: 'a', cats: ['tech'] });
    const pricey = influencer({
      id: 'b',
      rates: [{ id: 'r', net: 'ig', fmt: 'Post', price: 900000 }],
    });
    expect(
      rankMatches([pricey, cheap], brief).map((m) => m.influencer.id),
    ).toEqual(['a', 'b']);
  });

  it('construit un lien UTM traçable', () => {
    const url = buildUtm(
      { ref: 'PU-2410-1', offerNet: 'ig', briefLink: 'https://savane.ci' },
      influencer().handle,
    );
    expect(url).toContain('utm_source');
  });

  it('calcule l’engagement pondéré et la commission 15 %', () => {
    expect(Math.round(avgEngagement(influencer()) * 10) / 10).toBe(6.3);
    expect(commissionOf(90_000, COMMISSION)).toBe(13_500);
    expect(netAfterCommission(90_000, COMMISSION)).toBe(76_500);
  });

  it('formate les montants comme le front', () => {
    expect(formatFcfa(90_000).replace(/\s/g, ' ')).toBe('90 000 FCFA');
  });

  it('fixe 16 influenceurs et les certifiés du seed', () => {
    const listed = seedInfluencerRecords();
    expect(listed).toHaveLength(16);
    expect(
      listed.filter((item) => item.certified).map((item) => item.id),
    ).toEqual(['i1', 'i3', 'i8', 'i10']);
    expect(listed[0]!.hue).toBe((1 * 47) % 360);
  });
});
