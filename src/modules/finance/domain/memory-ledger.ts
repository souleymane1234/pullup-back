import { AppError } from '../../../common/http/app.error.js';
import {
  assertBalanced,
  applySigned,
  balanceToEscrowLines,
  balanceToRevenueLines,
  brandCreditLines,
  collectRevenueLines,
  collectToEscrowLines,
  escrowToBrandLines,
  payoutFailedLines,
  refundEscrowLines,
  releaseEscrowLines,
  revenueToBrandLines,
  walletToPayoutLines,
  type CampaignMoney,
  type LedgerLine,
} from './ledger.js';

interface Hold {
  campaign: CampaignMoney;
  state: 'open' | 'released' | 'refunded';
}

export class MemoryLedger {
  readonly entries: LedgerLine[] = [];
  readonly brands = new Map<string, number>();
  readonly wallets = new Map<string, number>();
  readonly holds = new Map<string, Hold>();
  private readonly queues = new Map<string, Promise<void>>();

  seedBrand(id: string, balance: number) {
    this.brands.set(id, balance);
  }

  seedWallet(id: string, balance: number) {
    this.wallets.set(id, balance);
  }

  async collectToEscrow(campaign: CampaignMoney, amountPsp: number) {
    return this.locked([`escrow:${campaign.id}`], () => {
      this.post(collectToEscrowLines(campaign, amountPsp));
      this.openHold(campaign);
    });
  }

  async balanceToEscrow(
    brandId: string,
    campaign: CampaignMoney,
    amount: number,
  ) {
    return this.locked([`brand:${brandId}`, `escrow:${campaign.id}`], () => {
      const current = this.brands.get(brandId) ?? 0;
      this.brands.set(brandId, applySigned(current, 'debit', amount));
      this.post(balanceToEscrowLines(brandId, campaign, amount));
      this.openHold(campaign);
    });
  }

  async releaseEscrow(campaign: CampaignMoney) {
    return this.locked(
      [`escrow:${campaign.id}`, `wallet:${campaign.influencerId}`],
      () => {
        this.requireOpen(campaign.id);
        const escrow = this.account('escrow', campaign.id);
        if (escrow < campaign.amount) {
          throw new AppError('Solde insuffisant.', 422);
        }
        this.post(releaseEscrowLines(campaign));
        this.wallets.set(
          campaign.influencerId,
          applySigned(
            this.wallets.get(campaign.influencerId) ?? 0,
            'credit',
            campaign.payout,
          ),
        );
        this.holds.get(campaign.id)!.state = 'released';
      },
    );
  }

  async escrowToBrand(campaign: CampaignMoney, amount: number) {
    return this.locked(
      [`escrow:${campaign.id}`, `brand:${campaign.brandId}`],
      () => {
        this.post(escrowToBrandLines(campaign, amount));
        this.brands.set(
          campaign.brandId,
          applySigned(this.brands.get(campaign.brandId) ?? 0, 'credit', amount),
        );
        if (
          this.account('escrow', campaign.id) <= 0 &&
          this.holds.get(campaign.id)
        ) {
          this.holds.get(campaign.id)!.state = 'refunded';
        }
      },
    );
  }

  async refundEscrow(campaign: CampaignMoney) {
    return this.locked(
      [`escrow:${campaign.id}`, `brand:${campaign.brandId}`],
      () => {
        this.requireOpen(campaign.id);
        this.post(refundEscrowLines(campaign));
        this.brands.set(
          campaign.brandId,
          applySigned(
            this.brands.get(campaign.brandId) ?? 0,
            'credit',
            campaign.amount,
          ),
        );
        this.holds.get(campaign.id)!.state = 'refunded';
      },
    );
  }

  async walletToPayout(influencerId: string, amount: number, label: string) {
    return this.locked([`wallet:${influencerId}`], () => {
      if ((this.wallets.get(influencerId) ?? 0) < amount) {
        throw new AppError('Montant supérieur à votre solde disponible.', 422);
      }
      this.wallets.set(
        influencerId,
        applySigned(this.wallets.get(influencerId) ?? 0, 'debit', amount),
      );
      this.post(walletToPayoutLines(influencerId, amount, label));
    });
  }

  async payoutFailed(influencerId: string, amount: number, label: string) {
    return this.locked([`wallet:${influencerId}`], () => {
      this.wallets.set(
        influencerId,
        applySigned(this.wallets.get(influencerId) ?? 0, 'credit', amount),
      );
      this.post(payoutFailedLines(influencerId, amount, label));
    });
  }

  async collectRevenue(purpose: string, amount: number) {
    return this.locked(['revenue'], () => {
      this.post(collectRevenueLines(purpose, amount));
    });
  }

  async balanceToRevenue(brandId: string, amount: number, label: string) {
    return this.locked([`brand:${brandId}`], () => {
      this.brands.set(
        brandId,
        applySigned(this.brands.get(brandId) ?? 0, 'debit', amount),
      );
      this.post(balanceToRevenueLines(brandId, amount, label));
    });
  }

  async creditBrand(brandId: string, amount: number, label: string) {
    return this.locked([`brand:${brandId}`], () => {
      this.brands.set(
        brandId,
        applySigned(this.brands.get(brandId) ?? 0, 'credit', amount),
      );
      this.post(brandCreditLines(brandId, amount, label));
    });
  }

  async revenueToBrand(brandId: string, amount: number, label: string) {
    return this.locked([`brand:${brandId}`], () => {
      this.brands.set(
        brandId,
        applySigned(this.brands.get(brandId) ?? 0, 'credit', amount),
      );
      this.post(revenueToBrandLines(brandId, amount, label));
    });
  }

  escrowOf(influencerId: string): number {
    return [...this.holds.values()]
      .filter(
        (hold) =>
          hold.campaign.influencerId === influencerId && hold.state === 'open',
      )
      .reduce((sum, hold) => sum + hold.campaign.payout, 0);
  }

  private account(type: LedgerLine['accountType'], id: string): number {
    return this.entries
      .filter((line) => line.accountType === type && line.accountId === id)
      .reduce(
        (sum, line) =>
          line.direction === 'credit'
            ? sum + line.amountFcfa
            : sum - line.amountFcfa,
        0,
      );
  }

  private openHold(campaign: CampaignMoney) {
    const current = this.holds.get(campaign.id);
    if (!current) {
      this.holds.set(campaign.id, { campaign, state: 'open' });
    }
  }

  private requireOpen(campaignId: string) {
    if (this.holds.get(campaignId)?.state !== 'open') {
      throw new AppError('Séquestre introuvable.', 404);
    }
  }

  private post(lines: LedgerLine[]) {
    assertBalanced(lines);
    this.entries.push(...lines);
  }

  private async locked(keys: string[], fn: () => void): Promise<void> {
    const token = keys.slice().sort().join('|');
    const previous = this.queues.get(token) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queues.set(
      token,
      previous.then(() => next),
    );
    await previous;
    try {
      fn();
    } finally {
      release();
    }
  }
}
