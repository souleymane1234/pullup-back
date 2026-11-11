import { formatFcfa } from '../../../common/format.js';
import { AppError } from '../../../common/http/app.error.js';
import { CampaignLifecycleService } from './campaign-lifecycle.service.js';

const influencer = {
  id: 'i1',
  handle: 'amakouassi',
  name: 'Ama Kouassi',
  nets: { ig: [100000, 5] },
  scoreDone: 10,
  scoreOnTime: 90,
  scoreBrief: 90,
  scoreRating: 4.8,
  scoreReviews: 61,
  scoreAuth: 90,
  scoreCreat: 4,
  verified: true,
  status: 'active',
  rates: [],
};

const brand = { userId: 'u1', role: 'brand' as const, profileId: 'b1' };
const inf = { userId: 'u2', role: 'influencer' as const, profileId: 'i1' };
const admin = { userId: 'admin', role: 'admin' as const, profileId: 'admin' };

function campaign(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    ref: 'PU-2610-001',
    brandId: 'b1',
    influencerId: 'i1',
    offerNet: 'ig',
    amountFcfa: 90_000,
    feeFcfa: 13_500,
    payoutFcfa: 76_500,
    status,
    briefTitle: 'Lancement',
    briefDate: null,
    publishedAt: status === 'published' ? new Date() : null,
    utmUrl: 'https://savane.ci?utm_source=pullup',
    brand: { id: 'b1', name: 'Savane Cosmetics' },
    influencer,
    review: null,
    events: [],
    ...extra,
  };
}

describe('cycle de vie des campagnes', () => {
  it('accepte puis refuse les transitions hors matrice', async () => {
    const { service, ledger } = harness('paid');
    await expect(service.act('c1', 'accept', inf)).resolves.toEqual({
      message: 'Campagne acceptée. Publiez à la date prévue.',
    });
    await expect(service.act('c1', 'validate', brand)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(ledger.releaseEscrow).not.toHaveBeenCalled();
  });

  it.each([
    [
      'accept',
      'paid',
      inf,
      'Campagne acceptée. Publiez à la date prévue.',
      'accepted',
    ],
    [
      'decline',
      'paid',
      inf,
      "Campagne refusée. L'annonceur est remboursé.",
      'declined',
    ],
    [
      'cancel',
      'paid',
      brand,
      `${formatFcfa(90_000)} recrédités sur votre solde PULLUP.`,
      'cancelled',
    ],
    [
      'cancel',
      'accepted',
      brand,
      `${formatFcfa(90_000)} recrédités sur votre solde PULLUP.`,
      'cancelled',
    ],
    [
      'validate',
      'published',
      brand,
      "Fonds libérés à l'influenceur.",
      'completed',
    ],
    [
      'validate',
      'published',
      admin,
      "Fonds libérés à l'influenceur.",
      'completed',
    ],
    [
      'dispute',
      'published',
      brand,
      "Litige transmis à l'équipe PULLUP.",
      'dispute',
    ],
    ['release', 'dispute', admin, "Fonds versés à l'influenceur.", 'completed'],
    ['refund', 'dispute', admin, 'Annonceur remboursé.', 'refunded'],
  ] as const)('%s depuis %s → %s', async (action, from, actor, message, to) => {
    const { service, store } = harness(from);
    const payload = action === 'dispute' ? { reason: 'Preuve hors brief' } : {};
    await expect(service.act('c1', action, actor, payload)).resolves.toEqual({
      message,
    });
    expect(store.status).toBe(to);
  });

  it('envoie la preuve et refuse un lien incomplet', async () => {
    const { service, store, notify } = harness('accepted');
    await expect(
      service.act('c1', 'proof', inf, { url: 'instagram.com/p/x' }),
    ).rejects.toMatchObject({
      status: 422,
    });
    const result = await service.act('c1', 'proof', inf, {
      url: 'https://instagram.com/p/x',
      note: 'Story + post',
    });
    expect(result.message).toBe('Preuve envoyée. Paiement à la validation.');
    expect(store.status).toBe('published');
    expect(store.proofUrl).toBe('https://instagram.com/p/x');
    expect(notify.notify).toHaveBeenCalledWith(
      'b1',
      'Ama Kouassi a publié « Lancement ». Validez pour libérer les fonds.',
      '/c/c1',
    );
  });

  it('refuse un litige sans motif', async () => {
    const { service } = harness('published');
    const error = await service
      .act('c1', 'dispute', brand, { reason: '  ' })
      .catch((caught) => caught);
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toEqual({
      message: 'Décrivez le problème rencontré.',
    });
  });

  it('libère le séquestre une seule fois', async () => {
    const { service, ledger, store } = harness('published');
    await service.act('c1', 'validate', brand);
    expect(ledger.releaseEscrow).toHaveBeenCalledTimes(1);
    expect(store.status).toBe('completed');
    const again = await service
      .act('c1', 'validate', brand)
      .catch((error) => error);
    expect(again.getStatus()).toBe(409);
    expect(ledger.releaseEscrow).toHaveBeenCalledTimes(1);
  });

  it('ignore un second clic simultané sur validate', async () => {
    const { service, ledger } = harness('published');
    const [first, second] = await Promise.allSettled([
      service.act('c1', 'validate', brand),
      service.act('c1', 'validate', brand),
    ]);
    const ok = [first, second].filter((item) => item.status === 'fulfilled');
    const denied = [first, second].filter((item) => item.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(denied).toHaveLength(1);
    expect(ledger.releaseEscrow).toHaveBeenCalledTimes(1);
  });

  it('rembourse le litige vers le solde annonceur', async () => {
    const { service, ledger } = harness('dispute');
    const result = await service.act('c1', 'refund', admin);
    expect(result.message).toBe('Annonceur remboursé.');
    expect(ledger.refundEscrow).toHaveBeenCalledTimes(1);
  });

  it('publie un avis unique et recalcule la note', async () => {
    const { service, db, notify } = harness('completed');
    const result = await service.review('c1', brand, {
      stars: 5,
      text: 'Parfait',
    });
    expect(result).toEqual({
      message: 'Merci ! Votre avis est publié sur la vitrine.',
    });
    expect(db.influencer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scoreRating: 4.8, scoreReviews: 62 }),
      }),
    );
    expect(notify.notify).toHaveBeenCalledWith(
      'i1',
      'Savane Cosmetics vous a laissé un avis 5/5.',
      '/i/amakouassi',
    );
  });

  it('refuse un second avis', async () => {
    const { service } = harness('completed', { review: { id: 'rv1' } });
    await expect(
      service.review('c1', brand, { stars: 5, text: 'Super' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('envoie un message modéré avant acceptation', async () => {
    const { service, db, notify } = harness('paid');
    const result = await service.message(
      'c1',
      brand,
      'Appelez le 07 00 00 00 00',
      '1.1.1.1',
    );
    expect(result).toEqual({ message: 'Message envoyé.' });
    expect(db.campaignMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromRole: 'brand',
          body: expect.stringContaining('[téléphone]'),
        }),
      }),
    );
    expect(notify.notify).toHaveBeenCalledWith(
      'i1',
      'Nouveau message de Savane Cosmetics sur « Lancement ».',
      '/c/c1',
    );
  });

  it('refuse un message vide', async () => {
    const { service } = harness('paid');
    const error = await service
      .message('c1', brand, '   ', '1.1.1.1')
      .catch((caught) => caught);
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toEqual({ message: 'Écrivez un message.' });
  });

  it('valide automatiquement les publications de 72 h', async () => {
    const old = new Date(Date.now() - 80 * 60 * 60 * 1000);
    const { service, ledger, store } = harness('published', {
      publishedAt: old,
    });
    const result = await service.autoValidatePublished();
    expect(result.message).toBe('1 campagne(s) validée(s) automatiquement.');
    expect(ledger.releaseEscrow).toHaveBeenCalled();
    expect(store.status).toBe('completed');
  });

  it('ne compte pas une publication déjà validée', async () => {
    const { service, store } = harness('published');
    store.status = 'completed';
    const result = await service.autoValidatePublished();
    expect(result.message).toBe('Aucune publication en attente de validation.');
  });

  it('compte un clic UTM une fois par IP et par jour', async () => {
    const { service, db } = harness('published');
    await expect(
      service.redirect('PU-2610-001', '10.0.0.1', 'Mozilla'),
    ).resolves.toBe('https://savane.ci?utm_source=pullup');
    await service.redirect('PU-2610-001', '10.0.0.1', 'Mozilla');
    expect(db.utmClick.create).toHaveBeenCalledTimes(1);
    expect(db.campaign.update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: { perfClicks: 1 },
    });
  });
});

function harness(status: string, extra: Record<string, unknown> = {}) {
  const store = campaign(status, extra);
  const ledger = {
    releaseEscrow: vi.fn().mockResolvedValue(undefined),
    refundEscrow: vi.fn().mockResolvedValue(undefined),
  };
  const notify = { notify: vi.fn().mockResolvedValue(undefined) };
  const redis = {
    incr: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue('0'),
    set: vi.fn(),
  };
  let click: unknown = null;
  let queue = Promise.resolve();
  const db = {
    $transaction: vi.fn(
      async (fn: (tx: unknown) => Promise<unknown> | unknown[]) => {
        if (typeof fn !== 'function') {
          return Promise.all(fn);
        }
        const previous = queue;
        let release: () => void = () => undefined;
        queue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await fn(db);
        } finally {
          release();
        }
      },
    ),
    $queryRaw: vi.fn().mockResolvedValue([]),
    campaign: {
      findUnique: vi.fn().mockImplementation(async () => store),
      findMany: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where?: { status?: string } } = {}) => {
            if (where?.status && store.status !== where.status) {
              return [];
            }
            return [store];
          },
        ),
      update: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(store, data);
            return store;
          },
        ),
    },
    campaignEvent: { create: vi.fn().mockResolvedValue({}) },
    campaignMessage: { create: vi.fn().mockResolvedValue({}) },
    utmClick: {
      count: vi.fn().mockImplementation(async () => (click ? 1 : 0)),
      findFirst: vi.fn().mockImplementation(async () => click),
      create: vi
        .fn()
        .mockImplementation(async ({ data }: { data: unknown }) => {
          click = data;
          return data;
        }),
    },
    review: { create: vi.fn().mockResolvedValue({}) },
    influencer: { update: vi.fn().mockResolvedValue({}) },
  };
  const service = new CampaignLifecycleService(
    db as never,
    ledger as never,
    redis as never,
    notify,
    { record: vi.fn() } as never,
  );
  return { service, ledger, store, notify, db };
}
