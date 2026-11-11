import { AppError } from '../../../common/http/app.error.js';
import { assertBalanced, releaseEscrowLines } from './ledger.js';
import { MemoryLedger } from './memory-ledger.js';

const campaign = {
  id: 'c1',
  brandId: 'b1',
  influencerId: 'i1',
  amount: 100_000,
  fee: 15_000,
  payout: 85_000,
};

describe('grand livre', () => {
  it('équilibre chaque opération', async () => {
    const ledger = new MemoryLedger();
    ledger.seedBrand('b1', 40_000);
    await ledger.collectToEscrow(campaign, 60_000);
    await ledger.balanceToEscrow('b1', campaign, 40_000);
    expect(ledger.escrowOf('i1')).toBe(85_000);
    await ledger.releaseEscrow(campaign);
    assertBalanced(ledger.entries);
    expect(ledger.brands.get('b1')).toBe(0);
    expect(ledger.wallets.get('i1')).toBe(85_000);
    expect(ledger.escrowOf('i1')).toBe(0);
    const released = releaseEscrowLines(campaign);
    expect(
      released
        .filter((line) => line.direction === 'debit')
        .reduce((sum, line) => sum + line.amountFcfa, 0),
    ).toBe(
      released
        .filter((line) => line.direction === 'credit')
        .reduce((sum, line) => sum + line.amountFcfa, 0),
    );
  });

  it('rembourse le séquestre vers le solde marque', async () => {
    const ledger = new MemoryLedger();
    await ledger.collectToEscrow(campaign, 100_000);
    await ledger.refundEscrow(campaign);
    assertBalanced(ledger.entries);
    expect(ledger.brands.get('b1')).toBe(100_000);
    expect(ledger.escrowOf('i1')).toBe(0);
  });

  it('refuse un solde négatif', async () => {
    const ledger = new MemoryLedger();
    ledger.seedBrand('b1', 10_000);
    await expect(
      ledger.balanceToEscrow('b1', campaign, 40_000),
    ).rejects.toBeInstanceOf(AppError);
    expect(ledger.brands.get('b1')).toBe(10_000);
  });

  it('recrédite un retrait échoué sans casser l’équilibre', async () => {
    const ledger = new MemoryLedger();
    ledger.seedWallet('i1', 15_000);
    await ledger.walletToPayout('i1', 10_000, 'Retrait Orange Money');
    expect(ledger.wallets.get('i1')).toBe(5_000);
    await ledger.payoutFailed('i1', 10_000, 'Retrait Orange Money recrédité');
    expect(ledger.wallets.get('i1')).toBe(15_000);
    assertBalanced(ledger.entries);
  });

  it('reste cohérent sous 10 opérations concurrentes', async () => {
    const ledger = new MemoryLedger();
    ledger.seedBrand('b1', 50_000);
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, index) =>
        ledger.balanceToEscrow('b1', { ...campaign, id: `c${index}` }, 10_000),
      ),
    );
    const ok = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.filter(
      (result) => result.status === 'rejected',
    ).length;
    expect(ok).toBe(5);
    expect(failed).toBe(5);
    expect(ledger.brands.get('b1')).toBe(0);
    assertBalanced(ledger.entries);
    expect(ledger.entries.every((line) => line.amountFcfa > 0)).toBe(true);
  });
});
