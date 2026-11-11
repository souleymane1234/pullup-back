import { moderateMessage } from './moderate.js';

describe('modération des messages', () => {
  it('masque téléphone et e-mail avant acceptation', () => {
    const raw = 'Appelez le 07 00 00 00 00 ou  aicha@savane.ci';
    expect(moderateMessage(raw, 'paid')).toContain('[téléphone]');
    expect(moderateMessage(raw, 'paid')).toContain('[email]');
    expect(moderateMessage(raw, 'accepted')).toBe(raw);
  });
});
