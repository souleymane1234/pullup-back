import { Logger } from '@nestjs/common';
import { AppError } from '../../../common/http/app.error.js';
import { EnvService } from '../../../config/env.service.js';
import { maskPhone } from '../domain/phone.js';
import {
  assertDepositAmount,
  bearerToken,
  CENTRAL_APIS,
  CENTRAL_APIS_DEFAULT_URL,
  clientNumber,
  collectStatusFromCallback,
  operatorOf,
  unwrapCentralResult,
} from './central-apis.js';
import { secretsMatch, signaturesMatch } from './hmac.js';
import type {
  CollectStatus,
  PaymentProvider,
  PayMethod,
  PayoutStatus,
} from './payment.port.js';

const DEPOSIT = '/api/v1/finance/deposit';
const WITHDRAW = '/api/v1/finance/withdraw';
const STATUS = '/api/v1/finance/status/transaction';

export class CentralApisProvider implements PaymentProvider {
  readonly name = CENTRAL_APIS;
  private readonly logger = new Logger(CentralApisProvider.name);

  constructor(private readonly env: EnvService) {}

  async initCollect(input: {
    reference: string;
    amount: number;
    method: PayMethod;
    phone?: string;
    otp?: string;
    description: string;
    customer: { name: string; email: string };
  }) {
    if (input.method === 'card') {
      throw new AppError(
        'Central APIS n’accepte pas la carte. Choisissez Orange Money, MTN, Moov ou Wave.',
        422,
      );
    }
    if (!input.phone) {
      throw new AppError('Indiquez le numéro Mobile Money.', 422);
    }
    const typeService = operatorOf(input.method);
    const body: Record<string, unknown> = {
      numberClient: clientNumber(input.phone),
      typeService,
      amount: assertDepositAmount(input.amount),
      reference: input.reference,
    };
    if (typeService === 'orange') {
      const otp = String(input.otp ?? '').trim();
      if (!otp) {
        throw new AppError(
          'Saisissez le code Orange Money (#144*82#) pour confirmer le paiement.',
          422,
        );
      }
      body.otp = otp;
    }
    if (typeService === 'wave') {
      const front = this.env.get('FRONT_ORIGIN').replace(/\/$/, '');
      body.return_url = `${front}/paiement?status=success`;
      body.cancel_url = `${front}/paiement?status=failure`;
    }
    this.logger.log(
      `Central APIS deposit ${input.reference} ${input.amount} ${typeService} ${maskPhone(input.phone)}`,
    );
    const result = await this.request('POST', DEPOSIT, body);
    return this.started(input.reference, result);
  }

  async getCollectStatus(providerRef: string): Promise<CollectStatus> {
    const result = await this.request(
      'GET',
      `${STATUS}/${encodeURIComponent(providerRef)}`,
    );
    return collectStatusFromCallback(result) ?? 'pending';
  }

  async initPayout(input: {
    reference: string;
    amount: number;
    operator: 'om' | 'mtn' | 'moov' | 'wave';
    phone: string;
  }) {
    const typeService = operatorOf(input.operator);
    this.logger.log(
      `Central APIS withdraw ${input.reference} ${input.amount} ${typeService} ${maskPhone(input.phone)}`,
    );
    const result = await this.request('POST', WITHDRAW, {
      numberClient: clientNumber(input.phone),
      typeService,
      amount: assertDepositAmount(input.amount),
      reference: input.reference,
    });
    const status = collectStatusFromCallback(result);
    return {
      providerRef: String(result.partner_reference ?? input.reference),
      status: status === 'succeeded' ? ('sent' as const) : ('pending' as const),
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
    const secret = this.sharedSecret();
    const token =
      headers['x-callback-token'] || bearerToken(headers.authorization);
    if (token) {
      return secretsMatch(secret, token);
    }
    const signature =
      headers['x-signature'] ??
      headers['x-webhook-signature'] ??
      headers['x-app-token'];
    if (signature && secret) {
      if (secretsMatch(secret, signature)) {
        return true;
      }
      return signaturesMatch(secret, rawBody, signature);
    }
    return Boolean(
      this.env.get('PAYMENT_CLIENT_ID') &&
      this.env.get('PAYMENT_CLIENT_SECRET'),
    );
  }

  private started(
    reference: string,
    result: Record<string, unknown>,
  ): {
    providerRef: string;
    status: 'pending' | 'succeeded';
    redirectUrl?: string;
  } {
    const status = collectStatusFromCallback(result);
    if (status === 'failed') {
      throw new AppError('Le paiement Mobile Money a échoué.', 422);
    }
    return {
      providerRef: String(result.partner_reference ?? reference),
      status: status === 'succeeded' ? 'succeeded' : 'pending',
      redirectUrl:
        typeof result.payment_url === 'string' ? result.payment_url : undefined,
    };
  }

  private sharedSecret(): string {
    return (
      this.env.get('PAYMENT_WEBHOOK_SECRET') ||
      this.env.get('PAYMENT_CLIENT_SECRET')
    );
  }

  private baseUrl(): string {
    return (
      this.env.get('PAYMENT_API_URL').replace(/\/$/, '') ||
      CENTRAL_APIS_DEFAULT_URL
    );
  }

  private authHeaders(): Record<string, string> {
    const access = this.env.get('PAYMENT_CLIENT_ID');
    const token = this.env.get('PAYMENT_CLIENT_SECRET');
    if (!access || !token) {
      throw new AppError(
        'Central APIS n’est pas configuré (PAYMENT_CLIENT_ID / PAYMENT_CLIENT_SECRET).',
        500,
      );
    }
    return {
      'content-type': 'application/json',
      'x-app-access': access,
      'x-app-token': token,
    };
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(`${this.baseUrl()}${path}`, {
      method,
      headers: this.authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    if (!response.ok && payload.etat !== false) {
      this.logger.warn(`Central APIS ${method} ${path} ${response.status}`);
      throw new AppError('Central APIS a refusé la transaction.', 502);
    }
    return unwrapCentralResult(payload);
  }
}
