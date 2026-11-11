import { maskEmail, maskSecrets } from './mask.js';

describe('masquage des journaux', () => {
  it('masque e-mail et téléphone', () => {
    expect(maskEmail('amakouassi@mail.ci')).toBe('a••@mail.ci');
    expect(
      maskSecrets('Contacter Ama 0700112233 ou ama@mail.ci'),
    ).not.toContain('0700112233');
    expect(maskSecrets('écrire à marketing@savane.ci')).toContain(
      'm••@savane.ci',
    );
  });
});
