import {
  PAY,
  WITHDRAW_OPERATORS,
  type PayKey,
} from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';

export const AMOUNT_MESSAGE =
  'Saisissez un montant multiple de 100, minimum 1 000 FCFA.';
export const BALANCE_MESSAGE = 'Montant supérieur à votre solde disponible.';
export const PHONE_MESSAGE = 'Saisissez votre numéro mobile money.';
export const OPERATOR_MESSAGE = 'Choisissez un opérateur mobile money.';
export const UNVERIFIED_MESSAGE =
  'Votre profil doit être vérifié pour retirer vos gains.';
export const LIMIT_MESSAGE = "Limite de retraits atteinte pour aujourd'hui.";
export const KYC_MESSAGE =
  "Une pièce d'identité est requise pour retirer davantage.";
export const CODE_SENT_MESSAGE =
  'Un code a été envoyé. Saisissez-le pour confirmer ce numéro.';
export const CODE_BAD_MESSAGE = 'Code incorrect.';

export type WithdrawOperator = (typeof WITHDRAW_OPERATORS)[number];

export function assertWithdrawAmount(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1000 ||
    value % 100 !== 0
  ) {
    throw new AppError(AMOUNT_MESSAGE, 422);
  }
  return value;
}

export function assertWithdrawPhone(value: unknown): {
  phone: string;
  digits: string;
} {
  const phone = String(value ?? '').trim();
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) {
    throw new AppError(PHONE_MESSAGE, 422);
  }
  return { phone, digits };
}

export function assertWithdrawOperator(value: unknown): WithdrawOperator {
  if (!WITHDRAW_OPERATORS.includes(value as WithdrawOperator)) {
    throw new AppError(OPERATOR_MESSAGE, 422);
  }
  return value as WithdrawOperator;
}

export function withdrawLabel(operator: string): string {
  return `Retrait ${PAY[operator as PayKey] ?? operator}`;
}

export function withdrawSentMessage(
  amount: number,
  operator: string,
  formatFcfa: (value: number) => string,
): string {
  return `${formatFcfa(amount)} envoyés sur ${PAY[operator as PayKey] ?? operator}.`;
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
