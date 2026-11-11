import { Inject, Injectable, Logger } from '@nestjs/common';
import { noteReconcileGap } from '../../../common/metrics/alerts.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    private readonly db: PrismaService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
  ) {}

  async inspect(): Promise<string[]> {
    const issues: string[] = [];
    const entries = await this.db.ledgerEntry.findMany();
    const byTx = new Map<string, { debit: number; credit: number }>();
    for (const row of entries) {
      const bucket = byTx.get(row.txId) ?? { debit: 0, credit: 0 };
      bucket[row.direction] += row.amountFcfa;
      byTx.set(row.txId, bucket);
    }
    for (const [txId, sums] of byTx) {
      if (sums.debit !== sums.credit) {
        issues.push(`tx ${txId} déséquilibrée`);
      }
    }

    const brands = await this.db.brand.findMany({
      select: { id: true, balanceFcfa: true },
    });
    for (const brand of brands) {
      const computed = this.sum(entries, 'brand_balance', brand.id);
      if (computed !== brand.balanceFcfa) {
        issues.push(
          `solde marque ${brand.id} ${brand.balanceFcfa} ≠ grand livre ${computed}`,
        );
      }
    }

    const wallets = await this.db.wallet.findMany();
    for (const wallet of wallets) {
      const computed = this.sum(
        entries,
        'influencer_wallet',
        wallet.influencerId,
      );
      if (computed !== wallet.availableFcfa) {
        issues.push(
          `portefeuille ${wallet.influencerId} ${wallet.availableFcfa} ≠ grand livre ${computed}`,
        );
      }
    }
    return issues;
  }

  async runNightly(): Promise<{ ok: boolean; issues: string[] }> {
    const issues = await this.inspect();
    if (issues.length) {
      this.logger.error(`Rapprochement : ${issues.join(' ; ')}`);
      noteReconcileGap(issues.length);
      await this.notify.notify(
        'admin',
        `Anomalie grand livre : ${issues.length} écart(s) détecté(s).`,
        '/admin?tab=finance',
      );
    }
    return { ok: issues.length === 0, issues };
  }

  private sum(
    entries: Array<{
      accountType: string;
      accountId: string | null;
      direction: string;
      amountFcfa: number;
    }>,
    type: string,
    id: string,
  ) {
    return entries
      .filter((row) => row.accountType === type && row.accountId === id)
      .reduce(
        (total, row) =>
          row.direction === 'credit'
            ? total + row.amountFcfa
            : total - row.amountFcfa,
        0,
      );
  }
}
