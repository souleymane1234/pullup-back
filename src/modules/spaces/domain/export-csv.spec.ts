import { campaignsCsv } from './export-csv.js';
import type { PresentedCampaign } from '../../campaigns/domain/present.js';

describe('export CSV campagnes', () => {
  it('écrit l’en-tête et une ligne', () => {
    const csv = campaignsCsv([
      {
        id: 'c1',
        ref: 'PU-2610-001',
        brandId: 'b1',
        infId: 'i1',
        offer: { id: 'r2', net: 'ig', fmt: 'Post', price: 90_000 },
        amount: 90_000,
        fee: 13_500,
        payout: 76_500,
        status: 'paid',
        createdAt: '2026-10-04T10:00:00.000Z',
        pay: 'om',
        brief: {
          title: 'Lancement',
          objective: 'notoriete',
          theme: 'beaute',
          text: '',
          link: '',
          date: null,
          file: null,
        },
        log: [],
        perf: null,
        proof: null,
        msgs: [],
        review: null,
        disputeReason: null,
        utm: 'https://savane.ci',
        influencer: {
          id: 'i1',
          handle: 'amakouassi',
          name: 'Ama Kouassi',
          hue: 47,
          photo: null,
          verified: true,
        },
        brand: { id: 'b1', name: 'Savane' },
      } satisfies PresentedCampaign,
    ]);
    expect(csv.startsWith('Référence,Campagne,Influenceur')).toBe(true);
    expect(csv).toContain('PU-2610-001');
    expect(csv).toContain('Ama Kouassi');
    expect(csv).toContain("En attente de l'influenceur");
  });
});
