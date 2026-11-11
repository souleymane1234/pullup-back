import { flagMessage } from './flags.js';

describe('flagMessage', () => {
  it('explique la coupure de V2', () => {
    expect(flagMessage('v2', false)).toBe(
      'V2 désactivée : les vitrines repassent en mode demande de devis.',
    );
  });

  it('annonce les autres bascules', () => {
    expect(flagMessage('v2', true)).toBe('V2 activée sur toute la plateforme.');
    expect(flagMessage('v3', false)).toBe(
      'V3 désactivée sur toute la plateforme.',
    );
  });
});
