import { firstName, normalizeEmail } from './email.js';

describe('email', () => {
  it('normalise trim et minuscules', () => {
    expect(normalizeEmail('  Aicha@Savane.CI ')).toBe('aicha@savane.ci');
  });

  it('extrait le prénom du contact', () => {
    expect(firstName('Aïcha Diomandé')).toBe('Aïcha');
  });
});
