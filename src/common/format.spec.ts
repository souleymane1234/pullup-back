import { formatFcfa } from './format.js';

describe('formatFcfa', () => {
  it('formate 90 000 FCFA comme le front', () => {
    expect(formatFcfa(90_000).replace(/\s/g, ' ')).toBe('90 000 FCFA');
  });
});
