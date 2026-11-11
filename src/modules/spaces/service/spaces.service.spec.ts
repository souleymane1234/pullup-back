import { AppError } from '../../../common/http/app.error.js';
import { SpacesService } from './spaces.service.js';

const brandAuth = { userId: 'u1', role: 'brand' as const, profileId: 'b1' };
const infAuth = { userId: 'u2', role: 'influencer' as const, profileId: 'i1' };

describe('espaces personnels', () => {
  it('ne montre à l’annonceur que ses campagnes et favoris, y compris non listés', async () => {
    const { service, campaigns, influencers } = harness();
    const space = await service.brandSpace(brandAuth);
    expect(campaigns.list).toHaveBeenCalledWith(brandAuth);
    expect(space.campaigns).toHaveLength(1);
    expect(space.campaigns[0].brandId).toBe('b1');
    expect(influencers.presentByIds).toHaveBeenCalledWith(['i9'], true);
    expect(space.favorites[0]).toMatchObject({
      id: 'i9',
      status: 'pending',
      favorite: true,
    });
    expect(space.brand.email).toBe('marketing@savane.ci');
    expect(space.brand.balance).toBe(35_000);
  });

  it('ne montre à l’influenceur que ses campagnes et demandes', async () => {
    const { service, campaigns } = harness();
    const space = await service.influencerSpace(infAuth);
    expect(campaigns.list).toHaveBeenCalledWith(infAuth);
    expect(
      space.campaigns.every((item: { infId: string }) => item.infId === 'i1'),
    ).toBe(true);
    expect(space.requests).toEqual([
      expect.objectContaining({
        infId: 'i1',
        from: 'Boutique Nana Wax',
        type: 'Partenariat',
      }),
    ]);
    expect(space.influencer.email).toBe('ama@mail.ci');
    expect(space.influencer.phone).toBe('0700000000');
    expect(space.escrow).toBe(76_500);
    expect(space.wallet.available).toBe(76_500);
    expect(space.wallet.tx[0]).toMatchObject({
      t: 'in',
      a: 76_500,
      l: 'Campagne PU-2610-001 libérée',
    });
  });

  it('aligne wallet.available sur le grand livre après libération et retrait', async () => {
    const { service } = harness({
      available: 1_500,
      entries: [
        {
          direction: 'credit',
          amountFcfa: 76_500,
          label: 'Campagne PU-2610-001 libérée',
          createdAt: new Date(),
        },
        {
          direction: 'debit',
          amountFcfa: 75_000,
          label: 'Retrait Orange Money',
          createdAt: new Date(),
        },
      ],
      campaigns: [
        { status: 'completed', payout: 76_500, infId: 'i1', brandId: 'b1' },
      ],
    });
    const space = await service.influencerSpace(infAuth);
    expect(space.wallet.available).toBe(1_500);
    expect(
      space.wallet.tx.map(
        (row: { t: string; a: number }) => `${row.t}:${row.a}`,
      ),
    ).toEqual(['in:76500', 'out:75000']);
    expect(space.escrow).toBe(0);
  });

  it('refuse le mauvais rôle et l’export hors Business', async () => {
    const { service } = harness();
    await expect(service.brandSpace(infAuth)).rejects.toBeInstanceOf(AppError);
    await expect(service.influencerSpace(brandAuth)).rejects.toBeInstanceOf(
      AppError,
    );
    await expect(service.exportCampaignsCsv(brandAuth)).rejects.toBeInstanceOf(
      AppError,
    );
  });

  it('enregistre le profil marque', async () => {
    const { service, db } = harness();
    await expect(
      service.updateBrand(brandAuth, {
        name: 'Savane',
        contact: 'Aïcha',
        sector: 'Beauté',
      }),
    ).resolves.toEqual({
      message: 'Profil enregistré.',
    });
    expect(db.brand.update).toHaveBeenCalled();
  });

  it('refuse un nom de marque vide', async () => {
    const { service } = harness();
    const error = await service
      .updateBrand(brandAuth, {
        name: '  ',
        contact: 'Aïcha',
        sector: 'Beauté',
      })
      .catch((caught) => caught);
    expect(error.getStatus()).toBe(422);
  });

  it('exporte le CSV pour la formule Business', async () => {
    const { service } = harness({
      plan: 'business',
      campaigns: [
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
        },
      ],
    });
    const csv = await service.exportCampaignsCsv(brandAuth);
    expect(csv).toContain('Référence');
    expect(csv).toContain('PU-2610-001');
  });
});

function harness(options?: {
  available?: number;
  plan?: string;
  entries?: Array<{
    direction: string;
    amountFcfa: number;
    label: string;
    createdAt: Date;
  }>;
  campaigns?: Array<Record<string, unknown>>;
}) {
  const campaigns = {
    list: vi.fn().mockResolvedValue(
      options?.campaigns ?? [
        {
          id: 'c1',
          brandId: 'b1',
          infId: 'i1',
          status: 'paid',
          payout: 76_500,
        },
      ],
    ),
  };
  const influencers = {
    presentByIds: vi
      .fn()
      .mockResolvedValue([
        { id: 'i9', status: 'pending', favorite: true, name: 'Yao' },
      ]),
    presentOwn: vi.fn().mockResolvedValue({
      id: 'i1',
      email: 'ama@mail.ci',
      phone: '0700000000',
      status: 'pending',
    }),
  };
  const db = {
    brand: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'b1',
        name: 'Savane Cosmetics',
        contactName: 'Aïcha Diomandé',
        plan: options?.plan ?? 'pro',
        sector: 'Cosmétique',
        balanceFcfa: 35_000,
        user: { email: 'marketing@savane.ci' },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    favorite: { findMany: vi.fn().mockResolvedValue([{ influencerId: 'i9' }]) },
    contactRequest: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'r1',
          influencerId: 'i1',
          fromName: 'Boutique Nana Wax',
          contact: '+225 07',
          message: 'Partenariat',
          type: 'Partenariat',
          createdAt: new Date(),
        },
      ]),
    },
    wallet: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ availableFcfa: options?.available ?? 76_500 }),
    },
    ledgerEntry: {
      findMany: vi.fn().mockResolvedValue(
        options?.entries ?? [
          {
            direction: 'credit',
            amountFcfa: 76_500,
            label: 'Campagne PU-2610-001 libérée',
            createdAt: new Date(),
          },
        ],
      ),
    },
  };
  const service = new SpacesService(
    db as never,
    campaigns as never,
    influencers as never,
  );
  return { service, campaigns, influencers, db };
}
