import type { CampaignStatus } from '@prisma/client';

export type PaymentPollStatus = 'awaiting_payment' | 'paid' | 'cancelled';

export function presentPaymentStatus(
  status: CampaignStatus | string,
): PaymentPollStatus {
  if (status === 'awaiting_payment') {
    return 'awaiting_payment';
  }
  if (status === 'cancelled' || status === 'refunded') {
    return 'cancelled';
  }
  return 'paid';
}
