import type {
  CollectStatus,
  PaymentProvider,
  PayoutStatus,
} from './payment.port.js';
import { secretsMatch, signaturesMatch } from './hmac.js';

export class FakeProvider implements PaymentProvider {
  readonly name = 'fake';
  private readonly collects = new Map<string, CollectStatus>();
  private readonly payouts = new Map<string, PayoutStatus>();

  constructor(private readonly webhookSecret: string) {}

  async initCollect(input: {
    reference: string;
    amount: number;
    method: 'om' | 'mtn' | 'moov' | 'wave' | 'card';
    phone?: string;
    description: string;
    customer: { name: string; email: string };
  }) {
    const providerRef = `fake_${input.reference}`;
    let status: CollectStatus = 'succeeded';
    if (input.reference.endsWith(':ok')) {
      status = 'succeeded';
    } else if (input.reference.endsWith(':fail')) {
      status = 'failed';
    } else if (input.reference.endsWith(':expire')) {
      status = 'expired';
    } else if (input.reference.endsWith(':pending')) {
      status = 'pending';
    }
    this.collects.set(providerRef, status);
    return {
      providerRef,
      status:
        status === 'succeeded' ? ('succeeded' as const) : ('pending' as const),
      redirectUrl:
        input.method === 'card'
          ? `https://pay.fake.test/card/${providerRef}`
          : undefined,
    };
  }

  async getCollectStatus(providerRef: string): Promise<CollectStatus> {
    return this.collects.get(providerRef) ?? 'pending';
  }

  async initPayout(input: {
    reference: string;
    amount: number;
    operator: 'om' | 'mtn' | 'moov' | 'wave';
    phone: string;
  }) {
    const providerRef = `fake_out_${input.reference}`;
    const status = input.reference.endsWith(':fail') ? 'failed' : 'sent';
    this.payouts.set(providerRef, status);
    return {
      providerRef,
      status: status === 'sent' ? ('sent' as const) : ('pending' as const),
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutStatus> {
    return this.payouts.get(providerRef) ?? 'pending';
  }

  simulateCollect(providerRef: string, status: CollectStatus) {
    this.collects.set(providerRef, status);
  }

  simulatePayout(providerRef: string, status: PayoutStatus) {
    this.payouts.set(providerRef, status);
  }

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean {
    const token = headers['x-callback-token'];
    if (token) {
      return secretsMatch(this.webhookSecret, token);
    }
    const signature =
      headers['x-webhook-signature'] ?? headers['X-Webhook-Signature'];
    return signaturesMatch(this.webhookSecret, rawBody, signature);
  }
}
