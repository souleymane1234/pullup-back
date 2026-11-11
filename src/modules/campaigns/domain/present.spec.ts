import { presentCampaign } from './present.js';

describe('présentation Campaign', () => {
  it('expose le format exact du front', () => {
    const view = presentCampaign({
      id: 'c1',
      ref: 'PU-2410-137',
      brandId: 'b1',
      influencerId: 'i1',
      offerRateId: 'r2',
      offerNet: 'ig',
      offerFormat: 'Post + carrousel',
      offerPrice: 90_000,
      amountFcfa: 90_000,
      feeFcfa: 13_500,
      payoutFcfa: 76_500,
      payMethod: 'om',
      status: 'paid',
      createdAt: new Date('2026-10-04T10:00:00Z'),
      briefTitle: 'Lancement',
      briefObjective: 'notoriete',
      briefTheme: 'beaute',
      briefText: 'Présenter le sérum.',
      briefLink: 'https://savane.ci',
      briefDate: null,
      briefFileUrl: null,
      utmUrl: 'https://savane.ci?utm_source=pullup',
      proofUrl: null,
      proofNote: null,
      proofAt: null,
      perfViews: null,
      perfLikes: null,
      perfComments: null,
      perfShares: null,
      perfClicks: null,
      disputeReason: null,
      brand: { id: 'b1', name: 'Savane Cosmetics' },
      influencer: {
        id: 'i1',
        handle: 'amakouassi',
        name: 'Ama Kouassi',
        hue: 47,
        photoUrl: null,
        verified: true,
      },
      events: [
        {
          status: 'paid',
          note: 'Paiement reçu',
          createdAt: new Date('2026-10-04T10:01:00Z'),
        },
      ],
      messages: [],
      review: null,
    });
    expect(view.infId).toBe('i1');
    expect(view.offer).toEqual({
      id: 'r2',
      net: 'ig',
      fmt: 'Post + carrousel',
      price: 90_000,
    });
    expect(view.perf).toBeNull();
    expect(view.proof).toBeNull();
    expect(view.review).toBeNull();
    expect(view.log[0]).toMatchObject({ s: 'paid', n: 'Paiement reçu' });
    expect(view.influencer.handle).toBe('amakouassi');
    expect(view.brand.name).toBe('Savane Cosmetics');
  });
});
