import {
  assertDepositAmount,
  clientNumber,
  collectStatusFromCallback,
  eventIdFromCallback,
  hasCallbackIdentity,
  isPayoutCallback,
  operatorOf,
  payoutStatusFromCallback,
  unwrapCentralResult,
} from './central-apis.js';

describe('Central APIS — mapping', () => {
  it('traduit les opérateurs en typeService minuscule', () => {
    expect(operatorOf('om')).toBe('orange');
    expect(operatorOf('mtn')).toBe('mtn');
    expect(operatorOf('moov')).toBe('moov');
    expect(operatorOf('wave')).toBe('wave');
    expect(() => operatorOf('card')).toThrow(/carte/i);
  });

  it('exige un montant ≥ 200 et multiple de 50', () => {
    expect(assertDepositAmount(500)).toBe(500);
    expect(() => assertDepositAmount(100)).toThrow(/200/);
    expect(() => assertDepositAmount(225)).toThrow(/multiple de 50/);
  });

  it('normalise le numéro sans indicatif', () => {
    expect(clientNumber('+225 07 00 00 00 00')).toBe('0700000000');
    expect(clientNumber('0501234567')).toBe('0501234567');
    expect(() => clientNumber('0700')).toThrow(/10 chiffres/);
  });

  it('lit un callback DONE (encaissement)', () => {
    const payload = {
      etat: true,
      result: {
        partner_reference: 'pay_abc',
        transaction_reference: 'OP-1',
        typeTransaction: 'DEPOSIT',
        state: 'INITIALISE',
        service: 'orange',
        payment_url: undefined,
      },
    };
    expect(eventIdFromCallback(payload)).toBe('pay_abc');
    expect(collectStatusFromCallback(payload)).toBe('pending');
    expect(isPayoutCallback(payload)).toBe(false);
    expect(hasCallbackIdentity(payload)).toBe(true);
    expect(collectStatusFromCallback({ result: { state: 'DONE' } })).toBe(
      'succeeded',
    );
    expect(collectStatusFromCallback({ result: { state: 'FAILURE' } })).toBe(
      'failed',
    );
  });

  it('lit un callback WITHDRAW en échec', () => {
    const payload = {
      etat: true,
      result: {
        partner_reference: 'payout_1',
        typeTransaction: 'WITHDRAW',
        state: 'FAILURE',
      },
    };
    expect(isPayoutCallback(payload)).toBe(true);
    expect(payoutStatusFromCallback(payload)).toBe('failed');
  });

  it('remonte le message d’erreur Central APIS', () => {
    expect(() =>
      unwrapCentralResult({ etat: false, error: ['Solde insuffisant'] }),
    ).toThrow(/Solde insuffisant/);
  });
});
