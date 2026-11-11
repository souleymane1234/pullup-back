import { Logger } from '@nestjs/common';
import { EnvService } from '../../../config/env.service.js';
import { maskPhone } from '../domain/phone.js';
import { signaturesMatch } from './hmac.js';
import type {
  CollectStatus,
  PaymentProvider,
  PayMethod,
  PayoutStatus,
} from './payment.port.js';

const CHECKOUT = 'https://api-checkout.cinetpay.com/v2/payment';
const CHECK = 'https://api-checkout.cinetpay.com/v2/payment/check';
const TRANSFER = 'https://client.cinetpay.com/v1/transfer/money/send/contact';

export class CinetPayProvider implements PaymentProvider {
  readonly name = 'cinetpay';
  private readonly logger = new Logger(CinetPayProvider.name);

  constructor(private readonly env: EnvService) {}

  async initCollect(input: {
    reference: string;
    amount: number;
    method: PayMethod;
    phone?: string;
    description: string;
    customer: { name: string; email: string };
  }) {
    const body = {
      apikey: this.env.get('PAYMENT_API_KEY'),
      site_id: this.env.get('PAYMENT_SITE_ID'),
      transaction_id: input.reference,
      amount: input.amount,
      currency: 'XOF',
      description: input.description,
      channels: input.method === 'card' ? 'CREDIT_CARD' : 'MOBILE_MONEY',
      customer_name: input.customer.name,
      customer_email: input.customer.email,
      customer_phone_number: input.phone ?? '',
    };
    this.logger.log(
      `CinetPay collect ${input.reference} ${input.amount} ${input.method} ${maskPhone(input.phone)}`,
    );
    const response = await fetch(CHECKOUT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      code?: string;
      data?: { payment_token?: string; payment_url?: string };
    };
    if (!response.ok || payload.code !== '201') {
      throw new Error('CinetPay a refusé l’encaissement.');
    }
    return {
      providerRef: payload.data?.payment_token ?? input.reference,
      status: 'pending' as const,
      redirectUrl:
        input.method === 'card' ? payload.data?.payment_url : undefined,
    };
  }

  async getCollectStatus(providerRef: string): Promise<CollectStatus> {
    const response = await fetch(CHECK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apikey: this.env.get('PAYMENT_API_KEY'),
        site_id: this.env.get('PAYMENT_SITE_ID'),
        transaction_id: providerRef,
      }),
    });
    const payload = (await response.json()) as {
      code?: string;
      data?: { status?: string };
    };
    const status = (payload.data?.status ?? '').toUpperCase();
    if (status === 'ACCEPTED' || payload.code === '00') {
      return 'succeeded';
    }
    if (status === 'REFUSED' || status === 'CANCELED') {
      return 'failed';
    }
    if (status === 'EXPIRED') {
      return 'expired';
    }
    return 'pending';
  }

  async initPayout(input: {
    reference: string;
    amount: number;
    operator: 'om' | 'mtn' | 'moov' | 'wave';
    phone: string;
  }) {
    this.logger.log(
      `CinetPay payout ${input.reference} ${input.amount} ${input.operator} ${maskPhone(input.phone)}`,
    );
    const response = await fetch(TRANSFER, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apikey: this.env.get('PAYMENT_API_KEY'),
        prefix: '225',
        phone: input.phone.replace(/\D/g, '').slice(-10),
        amount: input.amount,
        notify_url: '',
        client_transaction_id: input.reference,
      }),
    });
    const payload = (await response.json()) as {
      code?: string;
      data?: Array<{ transaction_id?: string }>;
    };
    if (!response.ok) {
      throw new Error('CinetPay a refusé le retrait.');
    }
    return {
      providerRef: payload.data?.[0]?.transaction_id ?? input.reference,
      status: 'pending' as const,
    };
  }

  async getPayoutStatus(providerRef: string): Promise<PayoutStatus> {
    const collect = await this.getCollectStatus(providerRef);
    if (collect === 'succeeded') {
      return 'sent';
    }
    if (collect === 'failed' || collect === 'expired') {
      return 'failed';
    }
    return 'pending';
  }

  verifyWebhook(headers: Record<string, string>, rawBody: Buffer): boolean {
    const signature =
      headers['x-webhook-signature'] ??
      headers['x-token'] ??
      headers['x-cinetpay-signature'] ??
      headers['X-Webhook-Signature'];
    return signaturesMatch(
      this.env.get('PAYMENT_WEBHOOK_SECRET'),
      rawBody,
      signature,
    );
  }
}
