import { AppError } from '../../../common/http/app.error.js';
import {
  AMOUNT_MESSAGE,
  assertWithdrawAmount,
  assertWithdrawOperator,
  assertWithdrawPhone,
  OPERATOR_MESSAGE,
  PHONE_MESSAGE,
  startOfUtcDay,
  withdrawSentMessage,
} from './withdraw.js';

describe('règles de retrait', () => {
  it('exige un entier multiple de 100, minimum 1 000', () => {
    expect(() => assertWithdrawAmount(900)).toThrow(AppError);
    expect(() => assertWithdrawAmount(1050)).toThrow(AppError);
    expect(() => assertWithdrawAmount(10.5)).toThrow(AppError);
    try {
      assertWithdrawAmount(500);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).getStatus()).toBe(422);
      expect((error as AppError).getResponse()).toEqual({
        message: AMOUNT_MESSAGE,
      });
    }
    expect(assertWithdrawAmount(1000)).toBe(1000);
    expect(assertWithdrawAmount(25000)).toBe(25000);
  });

  it('exige un numéro mobile money et un opérateur connu', () => {
    expect(() => assertWithdrawPhone('123')).toThrow(PHONE_MESSAGE);
    expect(assertWithdrawPhone('+225 07 00 00 00 00').digits).toBe(
      '2250700000000',
    );
    expect(() => assertWithdrawOperator('card')).toThrow(OPERATOR_MESSAGE);
    expect(assertWithdrawOperator('om')).toBe('om');
  });

  it('formule le message d’envoi comme le front', () => {
    expect(withdrawSentMessage(15_000, 'om', (value) => `${value} FCFA`)).toBe(
      '15000 FCFA envoyés sur Orange Money.',
    );
    expect(startOfUtcDay(new Date('2026-10-04T22:15:00Z')).toISOString()).toBe(
      '2026-10-04T00:00:00.000Z',
    );
  });
});
