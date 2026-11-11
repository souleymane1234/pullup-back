import { maskPhone } from './phone.js';

describe('maskPhone', () => {
  it('masque un numéro ivoirien', () => {
    expect(maskPhone('+225 07 48 22 19 12')).toBe('07 •• •• 12');
    expect(maskPhone('0748221912')).toBe('07 •• •• 12');
  });
});
