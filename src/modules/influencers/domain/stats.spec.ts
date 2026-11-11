import { presentInfluencer } from './present.js';
import { presentVitrineStats } from './stats.js';

const kara = {
  net: {
    fb: [450_000, 4] as [number, number],
    ig: [180_000, 4] as [number, number],
    sc: [90_000, 4] as [number, number],
    tt: [300_000, 4] as [number, number],
  },
  rates: [{ id: 'r0', net: 'fb', fmt: 'Story / post', price: 25000 }],
  auth: 90,
  creat: 4,
  brief: 90,
  onTime: 90,
  verified: false,
  status: 'pending',
  aud: {
    f: 55,
    ages: [10, 45, 32, 13],
    cities: [
      ['Abidjan', 60],
      ['Autres', 40],
    ] as Array<[string, number]>,
  },
  done: 0,
};

describe('presentVitrineStats', () => {
  it('assemble audience, âges, réseaux et score PULLUP pour Kara', () => {
    const stats = presentVitrineStats(kara);
    expect(stats.networks).toEqual([
      { key: 'fb', label: 'Facebook', followers: 450000, engagement: 4 },
      { key: 'ig', label: 'Instagram', followers: 180000, engagement: 4 },
      { key: 'sc', label: 'Snapchat', followers: 90000, engagement: 4 },
      { key: 'tt', label: 'TikTok', followers: 300000, engagement: 4 },
    ]);
    expect(stats.audience).toEqual({
      cities: [
        { label: 'Abidjan', value: 60 },
        { label: 'Autres', value: 40 },
      ],
      ages: [
        { label: '13-17 ans', value: 10 },
        { label: '18-24 ans', value: 45 },
        { label: '25-34 ans', value: 32 },
        { label: '35+ ans', value: 13 },
      ],
      gender: { women: 55, men: 45 },
    });
    expect(stats.score.value).toBe(3.9);
    expect(stats.score.bars).toEqual([
      { key: 'engagement', label: 'Engagement', value: 57 },
      { key: 'auth', label: 'Authenticité', value: 90 },
      { key: 'creat', label: 'Créativité', value: 80 },
      { key: 'brief', label: 'Briefs', value: 90 },
      { key: 'onTime', label: 'Délais', value: 90 },
    ]);
    expect(stats.score.done).toBe(0);
    expect(stats.score.onTime).toBe(90);
    expect(stats.score.caption).toBe(
      "0 campagnes réalisées sur PULLUP · 90 % publiées à l'heure · audience auditée quotidiennement.",
    );
  });

  it('expose pullupScore et stats sur presentInfluencer', () => {
    const presented = presentInfluencer(
      {
        ...kara,
        id: 'i99',
        handle: 'karaalbert',
        name: 'Kara Albert',
        city: 'Abidjan',
        cats: ['humour'],
        bio: '',
        rating: 5,
        reviews: 0,
        days: ['Lun'],
        certified: false,
        accepts: { pub: true, partenariat: true, dedicace: false },
        views: [],
        qr: 0,
        contacts: 0,
        hue: 1,
        photo: null,
      },
      false,
    );
    expect(presented.pullupScore).toBe(3.9);
    expect(presented.stats.score.value).toBe(3.9);
    expect(presented.net).toEqual(kara.net);
    expect(presented.aud).toEqual(kara.aud);
    expect(presented.auth).toBe(90);
  });
});
