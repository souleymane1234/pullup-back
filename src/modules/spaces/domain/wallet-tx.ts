export interface WalletTx {
  t: 'in' | 'out';
  a: number;
  l: string;
  at: string;
}

export function presentWalletTx(
  entries: Array<{
    direction: string;
    amountFcfa: number;
    label: string;
    createdAt: Date;
  }>,
): WalletTx[] {
  return entries.slice(0, 50).map((entry) => ({
    t: entry.direction === 'credit' ? 'in' : 'out',
    a: entry.amountFcfa,
    l: entry.label,
    at: entry.createdAt.toISOString(),
  }));
}

export function walletAvailableFromLedger(
  entries: Array<{ direction: string; amountFcfa: number }>,
): number {
  return entries.reduce(
    (sum, entry) =>
      sum +
      (entry.direction === 'credit' ? entry.amountFcfa : -entry.amountFcfa),
    0,
  );
}
