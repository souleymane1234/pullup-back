import { AppError } from '../../../common/http/app.error.js';
import { FinanceEvents } from '../../finance/domain/events.js';
import { CampaignsService } from './campaigns.service.js';

const brief = {
  title: 'Lancement',
  objective: 'notoriete',
  theme: 'beaute',
  text: 'Présenter le sérum dans une routine du matin.',
  link: 'https://savane.ci',
};

const auth = { userId: 'u1', role: 'brand' as const, profileId: 'b1' };

describe('CampaignsService', () => {
  it('paie immédiatement si le solde couvre tout', async () => {
    const { service, ledger, payments, notify, store } = harness({
      balance: 90_000,
    });
    const result = await service.create(auth, {
      infId: 'i1',
      rateId: 'r2',
      pay: 'om',
      phone: '0700000000',
      brief,
    });
    expect(result).toEqual({
      id: 'c1',
      status: 'paid',
      message: 'Paiement reçu. Les fonds sont sous séquestre.',
    });
    expect(ledger.balanceToEscrow).toHaveBeenCalledWith(
      'b1',
      expect.objectContaining({ amount: 90_000, fee: 13_500, payout: 76_500 }),
      90_000,
    );
    expect(payments.initiateCollect).not.toHaveBeenCalled();
    expect(store.status).toBe('paid');
    expect(notify.notify).toHaveBeenCalledWith(
      'i1',
      expect.stringMatching(/Nouvelle campagne de Savane Cosmetics/),
      '/c/c1',
    );
  });

  it('attend le webhook si le solde est partiel, puis encaisse', async () => {
    const { service, ledger, payments, store } = harness({
      balance: 35_000,
      collect: { paymentId: 'p1', status: 'pending' },
    });
    const result = await service.create(auth, {
      infId: 'i1',
      rateId: 'r2',
      pay: 'om',
      phone: '0700000000',
      brief,
    });
    expect(result.status).toBe('awaiting_payment');
    expect(result.message).toBe('Confirmez le paiement sur votre téléphone.');
    expect(ledger.balanceToEscrow).toHaveBeenCalledWith(
      'b1',
      expect.anything(),
      35_000,
    );
    expect(payments.initiateCollect).toHaveBeenCalledWith(
      expect.objectContaining({ amountFcfa: 55_000 }),
    );
    expect(store.status).toBe('awaiting_payment');

    await service.onPaymentSucceeded({
      type: 'payment.succeeded',
      id: 'p1',
      targetId: 'c1',
      amount: 55_000,
      purpose: 'campaign',
    });
    expect(ledger.collectToEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1' }),
      55_000,
    );
    expect(store.status).toBe('paid');
  });

  it('restaure le solde si le paiement échoue', async () => {
    const { service, ledger, notify, store } = harness({
      balance: 35_000,
      collect: { paymentId: 'p1', status: 'pending' },
    });
    await service.create(auth, {
      infId: 'i1',
      rateId: 'r2',
      pay: 'om',
      phone: '0700000000',
      brief,
    });
    await service.onPaymentFailed({
      type: 'payment.failed',
      id: 'p1',
      targetId: 'c1',
      amount: 55_000,
      purpose: 'campaign',
    });
    expect(ledger.escrowToBrand).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c1' }),
      35_000,
    );
    expect(store.status).toBe('cancelled');
    expect(store.cancelReason).toBe('payment_failed');
    expect(notify.notify).toHaveBeenCalledWith(
      'b1',
      expect.stringMatching(/n'a pas abouti/),
      '/c/c1',
    );
  });

  it('refuse un quota free dépassé', async () => {
    const { service } = harness({ used: 3, plan: 'free' });
    const error = await service
      .create(auth, {
        infId: 'i1',
        rateId: 'r2',
        pay: 'om',
        phone: '0700000000',
        brief,
      })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getStatus()).toBe(403);
    expect(error.getResponse()).toEqual({
      message: 'Quota de campagnes atteint pour votre formule.',
    });
  });

  it('refuse l’offre d’un autre influenceur', async () => {
    const { service } = harness();
    const error = await service
      .create(auth, {
        infId: 'i1',
        rateId: 'other',
        pay: 'om',
        phone: '0700000000',
        brief,
      })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getStatus()).toBe(422);
    expect(error.getResponse()).toEqual({ message: 'Choisissez une offre.' });
  });
});

function harness(options?: {
  balance?: number;
  plan?: 'free' | 'pro' | 'business';
  used?: number;
  collect?: {
    paymentId: string;
    status: 'pending' | 'succeeded';
    redirectUrl?: string;
  };
}) {
  const store: Record<string, unknown> = {
    status: 'awaiting_payment',
    cancelReason: null,
  };
  const db = {
    brand: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'b1',
        plan: options?.plan ?? 'pro',
        balanceFcfa: options?.balance ?? 0,
        name: 'Savane Cosmetics',
        user: { id: 'u1', email: 'marketing@savane.ci' },
      }),
    },
    influencer: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'i1',
        handle: 'amakouassi',
        verified: true,
        status: 'active',
        rates: [{ id: 'r2', net: 'ig', fmt: 'Post', price: 90_000 }],
      }),
    },
    campaign: {
      count: vi.fn().mockResolvedValue(options?.used ?? 0),
      create: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(store, { id: 'c1', ...data });
            return store;
          },
        ),
      findUnique: vi
        .fn()
        .mockImplementation(
          async ({ include }: { include?: { brand?: boolean } } = {}) =>
            include?.brand
              ? { ...store, brand: { id: 'b1', name: 'Savane Cosmetics' } }
              : store,
        ),
      update: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(store, data);
            return store;
          },
        ),
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            if (store.status !== 'awaiting_payment') {
              return { count: 0 };
            }
            Object.assign(store, data);
            return { count: 1 };
          },
        ),
    },
    campaignEvent: { create: vi.fn().mockResolvedValue({}) },
    upload: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const ledger = {
    balanceToEscrow: vi.fn().mockResolvedValue(undefined),
    collectToEscrow: vi.fn().mockResolvedValue(undefined),
    escrowToBrand: vi.fn().mockResolvedValue(undefined),
  };
  const payments = {
    initiateCollect: vi
      .fn()
      .mockResolvedValue(
        options?.collect ?? { paymentId: 'p1', status: 'pending' },
      ),
  };
  const notify = { notify: vi.fn().mockResolvedValue(undefined) };
  const service = new CampaignsService(
    db as never,
    { presentedByHandle: vi.fn() } as never,
    { nextCampaignRef: vi.fn().mockResolvedValue('PU-2610-001') } as never,
    ledger as never,
    payments as never,
    new FinanceEvents(),
    notify,
  );
  return { service, ledger, payments, notify, store };
}
