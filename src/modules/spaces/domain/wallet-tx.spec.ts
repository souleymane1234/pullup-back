import { presentWalletTx, walletAvailableFromLedger } from './wallet-tx.js';

describe('mouvements de portefeuille', () => {
  it('mappe crédits et débits du grand livre, 50 derniers d’abord', () => {
    const at = new Date('2026-10-04T10:00:00Z');
    const tx = presentWalletTx([
      {
        direction: 'credit',
        amountFcfa: 76_500,
        label: 'Campagne PU-2409-118 libérée',
        createdAt: at,
      },
      {
        direction: 'debit',
        amountFcfa: 50_000,
        label: 'Retrait Orange Money',
        createdAt: at,
      },
      {
        direction: 'credit',
        amountFcfa: 50_000,
        label: 'Retrait échoué',
        createdAt: at,
      },
    ]);
    expect(tx).toEqual([
      {
        t: 'in',
        a: 76_500,
        l: 'Campagne PU-2409-118 libérée',
        at: at.toISOString(),
      },
      { t: 'out', a: 50_000, l: 'Retrait Orange Money', at: at.toISOString() },
      { t: 'in', a: 50_000, l: 'Retrait échoué', at: at.toISOString() },
    ]);
    expect(
      walletAvailableFromLedger(
        tx.map((row, i) => ({
          direction: i === 1 ? 'debit' : 'credit',
          amountFcfa: row.a,
        })),
      ),
    ).toBe(76_500);
  });
});
