export type PayMethod = 'om' | 'mtn' | 'moov' | 'wave' | 'card';
export type PayOperator = 'om' | 'mtn' | 'moov' | 'wave';
export type CollectStatus = 'pending' | 'succeeded' | 'failed' | 'expired';
export type PayoutInitStatus = 'pending' | 'sent';
export type PayoutStatus = 'pending' | 'sent' | 'failed';

export interface PaymentProvider {
  readonly name: string;
  initCollect(input: {
    reference: string;
    amount: number;
    method: PayMethod;
    phone?: string;
    otp?: string;
    description: string;
    customer: { name: string; email: string };
  }): Promise<{
    providerRef: string;
    status: 'pending' | 'succeeded';
    redirectUrl?: string;
  }>;
  getCollectStatus(providerRef: string): Promise<CollectStatus>;
  initPayout(input: {
    reference: string;
    amount: number;
    operator: PayOperator;
    phone: string;
  }): Promise<{ providerRef: string; status: PayoutInitStatus }>;
  getPayoutStatus(providerRef: string): Promise<PayoutStatus>;
  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean;
}

export const PAYMENT = Symbol('PAYMENT');
