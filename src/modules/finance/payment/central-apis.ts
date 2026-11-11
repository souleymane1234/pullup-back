import { AppError } from '../../../common/http/app.error.js';
import type {
  CollectStatus,
  PayMethod,
  PayOperator,
  PayoutStatus,
} from './payment.port.js';

export const CENTRAL_APIS = 'central-apis';
export const CENTRAL_APIS_DEFAULT_URL = 'https://api.centralapis.com';

const OPERATORS: Record<Exclude<PayMethod, 'card'>, string> = {
  om: 'orange',
  mtn: 'mtn',
  moov: 'moov',
  wave: 'wave',
};

const SUCCESS = new Set([
  'DONE',
  'SUCCESS',
  'SUCCEEDED',
  'SUCCESSFUL',
  'PAID',
  'ACCEPTED',
  'COMPLETED',
  'OK',
]);
const FAILED = new Set([
  'FAILURE',
  'FAILED',
  'FAIL',
  'REFUSED',
  'CANCELED',
  'CANCELLED',
  'ERROR',
  'REJECTED',
]);
const PENDING = new Set([
  'INITIALISE',
  'INITIALIZED',
  'PENDING',
  'PROCESSING',
  'INITIATED',
  'WAITING',
]);

export function operatorOf(method: PayMethod | PayOperator): string {
  if (method === 'card') {
    throw new AppError(
      'Central APIS n’accepte pas la carte. Choisissez Orange Money, MTN, Moov ou Wave.',
      422,
    );
  }
  return OPERATORS[method];
}

export function assertDepositAmount(amount: number): number {
  if (!Number.isInteger(amount) || amount < 200 || amount % 50 !== 0) {
    throw new AppError(
      'Le montant doit être au moins 200 FCFA et un multiple de 50.',
      422,
    );
  }
  return amount;
}

export function clientNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const local = digits.startsWith('225') ? digits.slice(3) : digits.slice(-10);
  if (local.length !== 10) {
    throw new AppError(
      'Saisissez un numéro de téléphone valide (10 chiffres, sans indicatif).',
      422,
    );
  }
  return local;
}

export function flattenCallback(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const nested = [payload.data, payload.transaction, payload.result].filter(
    (value): value is Record<string, unknown> =>
      Boolean(value) && typeof value === 'object' && !Array.isArray(value),
  );
  return Object.assign({}, ...nested, payload);
}

function rawStatus(payload: Record<string, unknown>): string {
  const flat = flattenCallback(payload);
  return String(
    flat.state ??
      flat.status ??
      flat.transaction_status ??
      flat.payment_status ??
      '',
  )
    .trim()
    .toUpperCase();
}

export function collectStatusFromCallback(
  payload: Record<string, unknown>,
): CollectStatus | null {
  const status = rawStatus(payload);
  if (SUCCESS.has(status)) {
    return 'succeeded';
  }
  if (FAILED.has(status)) {
    return 'failed';
  }
  if (PENDING.has(status)) {
    return 'pending';
  }
  return null;
}

export function payoutStatusFromCallback(
  payload: Record<string, unknown>,
): PayoutStatus | null {
  const status = collectStatusFromCallback(payload);
  if (status === 'succeeded') {
    return 'sent';
  }
  if (status === 'failed' || status === 'expired') {
    return 'failed';
  }
  if (status === 'pending') {
    return 'pending';
  }
  return null;
}

export function eventIdFromCallback(payload: Record<string, unknown>): string {
  const flat = flattenCallback(payload);
  return String(
    flat.partner_reference ??
      flat.transaction_reference ??
      flat.event_id ??
      flat.cpm_trans_id ??
      flat.transaction_id ??
      flat.transactionId ??
      flat.reference ??
      flat.client_reference ??
      flat.external_id ??
      flat.providerRef ??
      flat.id ??
      '',
  ).trim();
}

export function refsFromCallback(payload: Record<string, unknown>): string[] {
  const flat = flattenCallback(payload);
  return [
    flat.partner_reference,
    flat.transaction_reference,
    flat.providerRef,
    flat.transaction_id,
    flat.transactionId,
    flat.reference,
    flat.client_reference,
    flat.external_id,
    flat.paymentId,
    flat.payoutId,
    flat.id,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

export function isPayoutCallback(payload: Record<string, unknown>): boolean {
  const flat = flattenCallback(payload);
  const type = String(
    flat.typeTransaction ?? flat.type ?? flat.operation ?? flat.kind ?? '',
  )
    .trim()
    .toUpperCase();
  return type === 'WITHDRAW' || type === 'CASHIN' || type === 'PAYOUT';
}

export function bearerToken(authorization: string | undefined): string {
  if (!authorization) {
    return '';
  }
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

export function hasCallbackIdentity(payload: Record<string, unknown>): boolean {
  return Boolean(eventIdFromCallback(payload));
}

export function unwrapCentralResult(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  if (payload.etat === false) {
    const errors = Array.isArray(payload.error)
      ? payload.error.map(String).join(' ')
      : '';
    throw new AppError(errors || 'Central APIS a refusé la transaction.', 502);
  }
  if (payload.result && typeof payload.result === 'object') {
    return payload.result as Record<string, unknown>;
  }
  return payload;
}
