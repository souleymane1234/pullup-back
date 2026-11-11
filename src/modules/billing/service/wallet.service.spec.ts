import { AppError } from '../../../common/http/app.error.js';
import {
  AMOUNT_MESSAGE,
  BALANCE_MESSAGE,
  UNVERIFIED_MESSAGE,
} from '../domain/withdraw.js';
import { WalletService } from './wallet.service.js';

const auth = { userId: 'u2', role: 'influencer' as const, profileId: 'i1' };

describe('WalletService', () => {
  it('refuse un montant invalide avant de toucher au solde', async () => {
    const { service, ledger } = harness();
    const error = await service
      .withdraw(auth, { amount: 900, operator: 'om', phone: '0700000000' })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getResponse()).toEqual({ message: AMOUNT_MESSAGE });
    expect(ledger.walletToPayout).not.toHaveBeenCalled();
  });

  it('bloque un profil non vérifié', async () => {
    const { service } = harness({ verified: false });
    const error = await service
      .withdraw(auth, { amount: 1000, operator: 'om', phone: '0700000000' })
      .catch((caught) => caught);
    expect(error.getResponse()).toEqual({ message: UNVERIFIED_MESSAGE });
    expect(error.getStatus()).toBe(403);
  });

  it('empêche deux retraits simultanés de dépasser le solde', async () => {
    const { service, state } = harness({ available: 1500 });
    const first = service.withdraw(auth, {
      amount: 1000,
      operator: 'om',
      phone: '0700000000',
    });
    const second = service.withdraw(auth, {
      amount: 1000,
      operator: 'mtn',
      phone: '0700000000',
    });
    const results = await Promise.allSettled([first, second]);
    const ok = results.filter((result) => result.status === 'fulfilled');
    const failed = results.filter((result) => result.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason.getResponse()).toEqual({
      message: BALANCE_MESSAGE,
    });
    expect(state.available).toBe(500);
  });

  it('recrédite une seule fois un retrait échoué', async () => {
    const { service, notify, db } = harness();
    db.withdrawal.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValue({ count: 0 });
    const event = {
      type: 'payout.failed' as const,
      id: 'po1',
      targetId: 'i1',
      amount: 1000,
    };
    await service.onPayoutFailed(event);
    await service.onPayoutFailed(event);
    expect(notify.notify).toHaveBeenCalledTimes(1);
    expect(notify.notify).toHaveBeenCalledWith(
      'i1',
      'Votre retrait de 1\u202f000 FCFA a échoué : le montant est de retour sur votre solde.',
      '/me?tab=wallet',
    );
  });
});

function harness(options?: { available?: number; verified?: boolean }) {
  const state = { available: options?.available ?? 5000, payouts: 0 };
  let gate = Promise.resolve();
  const db = {
    influencer: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'i1',
        verified: options?.verified ?? true,
        kycStatus: 'none',
        trustedPhones: ['0700000000'],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    withdrawal: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountFcfa: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const previous = gate;
      let release = () => undefined;
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await fn({
          payout: {
            create: vi
              .fn()
              .mockImplementation(
                async ({ data }: { data: Record<string, unknown> }) => {
                  state.payouts += 1;
                  return { id: `po${state.payouts}`, targetId: 'i1', ...data };
                },
              ),
          },
          withdrawal: {
            create: vi
              .fn()
              .mockImplementation(
                async ({ data }: { data: Record<string, unknown> }) => ({
                  id: `w${state.payouts}`,
                  ...data,
                }),
              ),
          },
        });
      } finally {
        release();
      }
    },
  };
  const ledger = {
    walletToPayout: vi
      .fn()
      .mockImplementation(async (_id: string, amount: number) => {
        if (state.available < amount) {
          throw new AppError(BALANCE_MESSAGE, 422);
        }
        state.available -= amount;
      }),
  };
  const payments = {
    dispatchPayout: vi.fn().mockResolvedValue({ status: 'sent' }),
  };
  const events = { on: vi.fn().mockReturnValue(() => undefined) };
  const redis = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
  const env = {
    get: vi.fn((key: string) => {
      if (key === 'WITHDRAW_DAILY_COUNT') return 3;
      if (key === 'WITHDRAW_DAILY_FCFA') return 500_000;
      if (key === 'WITHDRAW_KYC_FCFA') return 1_000_000;
      if (key === 'DEMO_MODE') return true;
      if (key === 'NODE_ENV') return 'test';
      return '';
    }),
  };
  const notify = { notify: vi.fn() };
  const service = new WalletService(
    db as never,
    ledger as never,
    payments as never,
    events as never,
    redis as never,
    env as never,
    notify as never,
  );
  return { service, ledger, payments, notify, db, state };
}
