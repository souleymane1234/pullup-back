import { AppError } from '../../../common/http/app.error.js';
import { assertQuota } from '../../campaigns/domain/booking.js';
import { UNKNOWN_PLAN } from '../domain/plans.js';
import { BillingService } from './billing.service.js';

const brandAuth = { userId: 'u1', role: 'brand' as const, profileId: 'b1' };
const infAuth = { userId: 'u2', role: 'influencer' as const, profileId: 'i1' };

describe('BillingService', () => {
  it('refuse une formule inconnue', async () => {
    const { service } = harness();
    const error = await service
      .setPlan(brandAuth, { plan: 'gold' })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getResponse()).toEqual({ message: UNKNOWN_PLAN });
  });

  it('active Pro immédiatement et applique le quota', async () => {
    const { service, db, ledger } = harness({ balance: 20_000 });
    const result = await service.setPlan(brandAuth, { plan: 'pro' });
    expect(result).toEqual({
      message: 'Formule Pro activée.',
      status: 'active',
    });
    expect(ledger.balanceToRevenue).toHaveBeenCalledWith(
      'b1',
      15_000,
      'Formule Pro',
    );
    expect(db.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ plan: 'pro' }),
      }),
    );
    expect(() => assertQuota('pro', 3)).not.toThrow();
    expect(() => assertQuota('free', 3)).toThrow(AppError);
  });

  it('repasse en Découverte après grâce', async () => {
    const ended = new Date('2026-09-01T00:00:00Z');
    const { service, db } = harness({
      pastDue: {
        id: 's1',
        brandId: 'b1',
        plan: 'pro',
        status: 'past_due',
        currentPeriodEnd: ended,
      },
    });
    await service.tick(new Date('2026-09-05T00:00:00Z'));
    expect(db.subscription.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { status: 'cancelled' },
    });
    expect(db.brand.update).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { plan: 'free', planRenewsAt: null },
    });
  });

  it('expire une option et retire ses effets', async () => {
    const { service, db } = harness({
      boost: {
        id: 'bp1',
        influencerId: 'i1',
        boostKey: 'certified',
        status: 'active',
        endsAt: new Date('2026-09-01T00:00:00Z'),
      },
    });
    await service.expireBoosts(new Date('2026-10-04T00:00:00Z'));
    expect(db.boostPurchase.update).toHaveBeenCalledWith({
      where: { id: 'bp1' },
      data: { status: 'expired' },
    });
    expect(db.influencer.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { certified: false },
    });
  });

  it('accepte le libellé du front pour un boost', async () => {
    const { service, payments } = harness();
    const result = await service.purchaseBoost(infAuth, {
      label: 'Influenceur Pro',
    });
    expect(result.message).toBe(
      'Option Influenceur Pro activée pour 30 jours.',
    );
    expect(result.status).toBe('active');
    expect(payments.initiateCollect).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'boost', amountFcfa: 5000 }),
    );
  });

  it('attend le paiement si le solde ne couvre pas la formule', async () => {
    const { service, payments } = harness({
      balance: 0,
      collect: { paymentId: 'p1', status: 'pending' },
    });
    const result = await service.setPlan(brandAuth, {
      plan: 'pro',
      pay: 'om',
      phone: '0700000000',
    });
    expect(result).toEqual({
      message: 'Confirmez le paiement sur votre téléphone.',
      status: 'awaiting_payment',
    });
    expect(payments.initiateCollect).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'plan', amountFcfa: 15_000 }),
    );
  });

  it('soumet l’option Certifié à la validation admin', async () => {
    const { service, notify, db } = harness({
      boostRow: {
        id: 'bp1',
        status: 'pending',
        boostKey: 'certified',
        influencerId: 'i1',
        influencer: { name: 'Ama' },
      },
    });
    await service.purchaseBoost(infAuth, {
      key: 'certified',
      pay: 'om',
      phone: '0700000000',
    });
    expect(notify.notify).toHaveBeenCalledWith(
      'admin',
      expect.stringMatching(/certification/i),
      '/admin',
    );
    expect(db.influencer.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { certified: true } }),
    );
  });
});

function harness(options?: {
  balance?: number;
  pastDue?: Record<string, unknown>;
  boost?: Record<string, unknown>;
  boostRow?: Record<string, unknown>;
  collect?: {
    paymentId: string;
    status: 'pending' | 'succeeded';
    redirectUrl?: string;
  };
}) {
  const store: Record<string, unknown> = {
    id: 's-new',
    brandId: 'b1',
    plan: 'pro',
    status: 'pending',
  };
  const boostStore = options?.boostRow ?? {
    id: 'bp1',
    status: 'pending',
    boostKey: 'pro',
    influencerId: 'i1',
    influencer: { name: 'Ama' },
  };
  const db = {
    brand: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'b1',
        name: 'Savane',
        plan: 'free',
        balanceFcfa: options?.balance ?? 0,
        user: { email: 'a@b.ci' },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    influencer: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'i1',
        name: 'Ama',
        phone: '0700000000',
        user: { email: 'ama@mail.ci' },
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    subscription: {
      create: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            Object.assign(store, data, { id: 's-new' });
            return store;
          },
        ),
      findUnique: vi.fn().mockImplementation(async () => store),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi
        .fn()
        .mockImplementation(
          async ({ where }: { where: { status?: string } }) => {
            if (where.status === 'past_due' && options?.pastDue) {
              return [options.pastDue];
            }
            return [];
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
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({
            where,
            data,
          }: {
            where: { id?: string };
            data: Record<string, unknown>;
          }) => {
            if (
              where.id === store.id &&
              store.status === 'pending' &&
              data.status === 'active'
            ) {
              Object.assign(store, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
    },
    boostPurchase: {
      create: vi.fn().mockResolvedValue(boostStore),
      findUnique: vi.fn().mockResolvedValue(boostStore),
      findMany: vi
        .fn()
        .mockResolvedValue(options?.boost ? [options.boost] : []),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi
        .fn()
        .mockImplementation(
          async ({ data }: { data: Record<string, unknown> }) => {
            if (boostStore.status === 'pending' && data.status === 'active') {
              Object.assign(boostStore, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        ),
    },
    payment: { findUnique: vi.fn().mockResolvedValue(null) },
  };
  const ledger = {
    balanceToRevenue: vi.fn().mockResolvedValue(undefined),
    revenueToBrand: vi.fn().mockResolvedValue(undefined),
  };
  const payments = {
    initiateCollect: vi
      .fn()
      .mockResolvedValue(
        options?.collect ?? { paymentId: 'p1', status: 'succeeded' },
      ),
  };
  const events = { on: vi.fn().mockReturnValue(() => undefined) };
  const env = {
    get: vi.fn((key: string) =>
      key === 'NODE_ENV' ? 'test' : key === 'DEMO_MODE' ? true : '',
    ),
  };
  const redis = { get: vi.fn().mockResolvedValue('0'), set: vi.fn() };
  const notify = { notify: vi.fn() };
  const service = new BillingService(
    db as never,
    ledger as never,
    payments as never,
    events as never,
    env as never,
    redis as never,
    notify as never,
  );
  return { service, db, ledger, payments, notify };
}
