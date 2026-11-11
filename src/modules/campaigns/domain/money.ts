import type { CampaignMoney } from '../../finance/domain/ledger.js';

export function campaignMoney(row: {
  id: string;
  brandId: string;
  influencerId: string;
  amountFcfa: number;
  feeFcfa: number;
  payoutFcfa: number;
  ref?: string;
}): CampaignMoney {
  return {
    id: row.id,
    brandId: row.brandId,
    influencerId: row.influencerId,
    amount: row.amountFcfa,
    fee: row.feeFcfa,
    payout: row.payoutFcfa,
    ref: row.ref,
  };
}
