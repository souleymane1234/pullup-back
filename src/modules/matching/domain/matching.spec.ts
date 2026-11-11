import { seedInfluencerRecords } from '../../../../prisma/seed-influencers.js';
import { matchOne, rankMatches, type MatchBrief } from './matching.js';
import { applyMatchingRights } from './rights.js';

const listed = seedInfluencerRecords();
const ama = listed.find((item) => item.id === 'i1')!;

const beautyIg: MatchBrief = {
  theme: 'beaute',
  objective: 'notoriete',
  net: 'ig',
  budget: 100000,
  age: '',
  gender: 'all',
  city: 'Abidjan',
};

const techTt: MatchBrief = {
  theme: 'tech',
  objective: 'engagement',
  net: 'tt',
  budget: 100000,
  age: '',
  gender: 'all',
  city: '',
};

const humourAny: MatchBrief = {
  theme: 'humour',
  objective: 'trafic',
  net: 'any',
  budget: 100000,
  age: '',
  gender: 'all',
  city: '',
};

describe('matching IA', () => {
  it('reproduit Ama Kouassi sur un brief beauté / Instagram / Abidjan', () => {
    const match = matchOne(ama, beautyIg)!;
    expect(match.note).toBe(4.8);
    expect(match.bestNet).toBe('ig');
    expect(match.reco).toBe('Campagnes de notoriété');
    expect(match.price).toBe(25000);
    expect(match.inBudget).toBe(true);
    expect(match.why[0]).toBe('Thématique alignée : Mode & beauté');
    expect(match.why[1]).toBe('Engagement de 5,8 % sur Instagram');
    expect(match.why[2]).toBe("64 % de l'audience à Abidjan");
    expect(match.why.at(-1)).toBe(
      "98 % des campagnes publiées à l'heure, audience authentique à 94 %",
    );
    expect(match.reach).toBe(Math.round(412000 * 0.3 * (0.75 + 0.5 * match.s)));
    expect(match.cpm).toBe((match.price / match.reach) * 1000);
  });

  it('classe les 3 briefs types comme le front', () => {
    const beauty = rankMatches(listed, beautyIg);
    expect(beauty.map((item) => item.influencer.id).slice(0, 4)).toEqual([
      'i4',
      'i13',
      'i1',
      'i6',
    ]);
    expect(beauty[0]!.note).toBe(4.8);
    expect(beauty.every((item) => item.bestNet === 'ig')).toBe(true);

    const tech = rankMatches(listed, techTt);
    expect(tech[0]!.influencer.id).toBe('i12');
    expect(tech[0]!.reco).toBe('Challenges et concours');
    expect(tech[0]!.why[1]).toBe('Engagement de 7,9 % sur TikTok');
    const yao = tech.find((item) => item.influencer.id === 'i3');
    expect(yao?.why[1]).toBe('Engagement de 6,9 % sur TikTok');

    const humour = rankMatches(listed, humourAny);
    expect(humour[0]!.influencer.id).toBe('i9');
    expect(humour[0]!.reco).toBe('Activations digitales');
    expect(humour[0]!.why[1]).toMatch(/en moyenne$/);
    expect(humour.map((item) => item.influencer.id).slice(0, 3)).toEqual([
      'i9',
      'i2',
      'i13',
    ]);
  });

  it('place les profils dans le budget avant les autres', () => {
    const pricey = {
      ...ama,
      id: 'expensive',
      rates: [{ id: 'rx', net: 'ig', fmt: 'Post', price: 900000 }],
    };
    const ranked = rankMatches([pricey, ama], beautyIg);
    expect(ranked.map((item) => item.influencer.id)).toEqual([
      'i1',
      'expensive',
    ]);
  });

  it('masque les prédictions et les profils réservés pour free / visiteur', () => {
    const ranked = rankMatches(listed, beautyIg);
    const free = applyMatchingRights(ranked, 'free');
    const visitor = applyMatchingRights(ranked, null);
    expect(free[0]).toMatchObject({
      reach: null,
      interactions: null,
      cpm: null,
    });
    expect(free[0]!.influencer).toMatchObject({
      id: ranked[0]!.influencer.id,
      handle: ranked[0]!.influencer.handle,
    });
    expect(free[3]).toMatchObject({
      masked: true,
      price: null,
      influencer: { id: 'masked-4', name: 'Profil réservé' },
    });
    expect(visitor[3]!.influencer).not.toHaveProperty('handle');
    expect(visitor[3]!.influencer).not.toHaveProperty('photo');

    const pro = applyMatchingRights(ranked, 'pro');
    expect(pro[0]!.reach).toBe(ranked[0]!.reach);
    expect(pro[3]!.influencer).toMatchObject({ id: ranked[3]!.influencer.id });
    expect(pro[3]).not.toHaveProperty('masked');

    const business = applyMatchingRights(ranked, 'business');
    expect(business[3]!.reach).toBe(ranked[3]!.reach);
    expect(business[3]!.influencer).toMatchObject({
      handle: ranked[3]!.influencer.handle,
    });
  });
});
