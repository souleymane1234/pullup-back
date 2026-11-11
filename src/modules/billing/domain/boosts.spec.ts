import { AppError } from '../../../common/http/app.error.js';
import { resolveBoost, UNKNOWN_BOOST } from './boosts.js';

describe('options influenceur', () => {
  it('accepte la clé ou le libellé du front', () => {
    expect(resolveBoost({ key: 'pro' })).toEqual({
      key: 'pro',
      label: 'Influenceur Pro',
      price: 5000,
    });
    expect(resolveBoost({ label: 'Certifié' })).toEqual({
      key: 'certified',
      label: 'Certifié',
      price: 10000,
    });
    expect(resolveBoost({ label: 'Analytics avancées' }).key).toBe('analytics');
  });

  it('refuse une option inconnue', () => {
    try {
      resolveBoost({ label: 'VIP' });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).getResponse()).toEqual({
        message: UNKNOWN_BOOST,
      });
    }
  });
});
