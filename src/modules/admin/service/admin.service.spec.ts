import { AppError } from '../../../common/http/app.error.js';
import { isListed } from '../../influencers/domain/metrics.js';
import { AdminService } from './admin.service.js';

const admin = { userId: 'ua', role: 'admin' as const, profileId: 'admin' };

describe('AdminService', () => {
  it('vérifie un profil : visible, notifié, e-mail et audit', async () => {
    const { service, db, notify, mail, audit, influencers } = harness();
    const result = await service.verify('i9', admin, '1.1.1.1');
    expect(result).toEqual({ message: 'Yao est maintenant vérifié.' });
    expect(db.influencer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { verified: true, status: 'active' } }),
    );
    expect(notify.notify).toHaveBeenCalledWith(
      'i9',
      "Votre profil est vérifié : votre vitrine est visible dans l'annuaire.",
      '/i/yao',
    );
    expect(mail.send).toHaveBeenCalledWith(
      'yao@mail.ci',
      'Votre profil PULLUP est vérifié',
      expect.stringMatching(/visible dans l'annuaire/),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'influencer_verify',
        targetId: 'i9',
        data: expect.objectContaining({
          before: { verified: false, status: 'pending' },
          after: { verified: true, status: 'active' },
        }),
      }),
    );
    expect(influencers.refreshListing).toHaveBeenCalled();
    expect(isListed({ verified: true, status: 'active' })).toBe(true);
  });

  it('écrit un audit pour refus, suspension, certification et crédit', async () => {
    const { service, audit, ledger } = harness();
    await service.reject('i9', admin, 'Audience incohérente');
    await service.suspend('i9', admin, 'Plainte');
    await service.certify('i9', admin);
    await service.creditBrand('b1', admin, {
      amount: 10_000,
      reason: 'Geste SAV',
    });
    expect(
      audit.record.mock.calls.map(
        (call: Array<{ action: string }>) => call[0].action,
      ),
    ).toEqual([
      'influencer_reject',
      'influencer_suspend',
      'influencer_certify',
      'brand_credit',
    ]);
    expect(ledger.creditBrand).toHaveBeenCalledWith(
      'b1',
      10_000,
      'Geste commercial : Geste SAV',
    );
  });

  it('refuse un geste commercial sans motif', async () => {
    const { service } = harness();
    const error = await service
      .creditBrand('b1', admin, { amount: 1000, reason: '   ' })
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.getResponse()).toEqual({
      message: 'Indiquez le motif du geste commercial.',
    });
  });

  it('livre le tableau de bord : toutes les campagnes, tous les profils, flags', async () => {
    const { service, campaigns, db, flags } = harness();
    const space = await service.dashboard(admin);
    expect(campaigns.list).toHaveBeenCalledWith(admin);
    expect(db.influencer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { user: { select: { email: true } } },
      }),
    );
    expect(db.brand.findMany).toHaveBeenCalled();
    expect(flags.list).toHaveBeenCalled();
    expect(space.flags).toEqual({ v2: true, v3: true });
  });
});

function harness() {
  const pending = {
    id: 'i9',
    name: 'Yao',
    handle: 'yao',
    phone: '0700000001',
    verified: false,
    certified: false,
    status: 'pending',
    scoreAuth: 80,
    scoreCreat: 4,
    scoreBrief: 80,
    scoreOnTime: 80,
    audience: { f: 50, ages: [10, 40, 30, 20], cities: [] },
    nets: { ig: [10000, 4] },
    rates: [],
    user: { email: 'yao@mail.ci' },
  };
  const db = {
    influencer: {
      findUnique: vi.fn().mockResolvedValue(pending),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi
        .fn()
        .mockResolvedValue({ ...pending, verified: true, status: 'active' }),
    },
    brand: {
      findUnique: vi.fn().mockResolvedValue({ id: 'b1', balanceFcfa: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    escrowHold: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountFcfa: 0 } }),
    },
    ledgerEntry: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountFcfa: 0 } }),
      findMany: vi.fn(),
    },
    withdrawal: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amountFcfa: 0 } }),
      findMany: vi.fn(),
    },
  };
  const campaigns = { list: vi.fn().mockResolvedValue([]) };
  const influencers = {
    hydrateRows: vi.fn().mockResolvedValue([]),
    refreshListing: vi.fn(),
  };
  const flags = { list: vi.fn().mockResolvedValue({ v2: true, v3: true }) };
  const audit = { record: vi.fn(), list: vi.fn() };
  const ledger = { creditBrand: vi.fn(), walletToPayout: vi.fn() };
  const payments = { dispatchPayout: vi.fn() };
  const reconcile = { inspect: vi.fn().mockResolvedValue([]) };
  const notify = { notify: vi.fn() };
  const mail = { send: vi.fn() };
  const service = new AdminService(
    db as never,
    campaigns as never,
    influencers as never,
    flags as never,
    audit as never,
    ledger as never,
    payments as never,
    reconcile as never,
    notify as never,
    mail as never,
  );
  return {
    service,
    db,
    notify,
    mail,
    audit,
    influencers,
    ledger,
    campaigns,
    flags,
  };
}
