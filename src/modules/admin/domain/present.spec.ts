import {
  ledgerCsv,
  presentAdminBrand,
  presentAdminInfluencer,
} from './present.js';
import type { InfluencerRecord } from '../../influencers/domain/present.js';

describe('présentation admin', () => {
  it('aligne les annonceurs sur l’espace marque', () => {
    expect(
      presentAdminBrand({
        id: 'b1',
        name: 'Savane',
        contactName: 'Aïcha',
        user: { email: 'a@b.ci' },
        plan: 'pro',
        sector: 'Beauté',
        balanceFcfa: 35_000,
      }),
    ).toEqual({
      id: 'b1',
      name: 'Savane',
      contact: 'Aïcha',
      email: 'a@b.ci',
      plan: 'pro',
      sector: 'Beauté',
      balance: 35_000,
    });
  });

  it('conserve email, téléphone et statut pending pour la vérification', () => {
    const record = {
      id: 'i9',
      handle: 'yao',
      name: 'Yao',
      city: 'Abidjan',
      cats: [],
      bio: '',
      net: {},
      aud: { f: 50, ages: [0, 0, 0, 0], cities: [] },
      auth: 80,
      creat: 4,
      brief: 80,
      onTime: 80,
      rating: 5,
      reviews: 0,
      done: 0,
      rates: [],
      days: [],
      verified: false,
      certified: false,
      status: 'pending',
      accepts: { pub: true, partenariat: true, dedicace: false },
      views: [],
      qr: 0,
      contacts: 0,
      hue: 1,
      photo: null,
    } satisfies InfluencerRecord;
    expect(
      presentAdminInfluencer(record, {
        email: 'yao@mail.ci',
        phone: '0700000001',
      }),
    ).toMatchObject({
      id: 'i9',
      status: 'pending',
      email: 'yao@mail.ci',
      phone: '0700000001',
    });
  });

  it('exporte le grand livre en CSV', () => {
    const csv = ledgerCsv([
      {
        createdAt: new Date('2026-10-01T10:00:00Z'),
        txId: 't1',
        accountType: 'platform_revenue',
        accountId: 'pullup',
        campaignId: null,
        direction: 'credit',
        amountFcfa: 15000,
        label: 'Formule Pro',
      },
    ]);
    expect(csv.split('\n')[0]).toContain('Montant FCFA');
    expect(csv).toContain('15000');
    expect(csv).toContain('Formule Pro');
  });
});
