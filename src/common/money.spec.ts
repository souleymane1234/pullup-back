import { AppError } from './http/app.error.js';
import { COMMISSION } from './catalog.js';
import {
  MAX_PAYMENT_FCFA,
  commissionOf,
  fcfa,
  fcfaCapped,
  netAfterCommission,
} from './money.js';

describe('money', () => {
  it('refuse un flottant', () => {
    expect(() => fcfa(1500.5)).toThrow(AppError);
  });

  it('calcule 15 % en entiers', () => {
    expect(commissionOf(100_000, COMMISSION)).toBe(15_000);
    expect(netAfterCommission(100_000, COMMISSION)).toBe(85_000);
  });

  it('plafonne un paiement à 2 000 000 FCFA', () => {
    expect(fcfaCapped(2_000_000)).toBe(MAX_PAYMENT_FCFA);
    expect(() => fcfaCapped(2_000_001)).toThrow(AppError);
  });
});
