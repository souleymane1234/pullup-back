import { AppError } from './http/app.error.js';

export const MAX_PAYMENT_FCFA = 2_000_000;

/** Montant métier : entier FCFA, jamais un flottant. */
export function fcfa(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new AppError('Le montant doit être un entier en FCFA.', 422);
  }
  return value;
}

export function commissionOf(gross: number, rate: number): number {
  const amount = fcfa(gross);
  return Math.round(amount * rate);
}

export function netAfterCommission(gross: number, rate: number): number {
  const amount = fcfa(gross);
  return amount - commissionOf(amount, rate);
}

export function fcfaPositive(value: unknown): number {
  const amount = fcfa(value);
  if (amount <= 0) {
    throw new AppError('Le montant doit être un entier en FCFA.', 422);
  }
  return amount;
}

export function fcfaCapped(value: unknown, max = MAX_PAYMENT_FCFA): number {
  const amount = fcfaPositive(value);
  if (amount > max) {
    throw new AppError(
      `Le montant ne peut pas dépasser ${max.toLocaleString('fr-FR')} FCFA.`,
      422,
    );
  }
  return amount;
}
