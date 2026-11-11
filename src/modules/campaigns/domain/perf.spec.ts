import { estimatePerf } from './perf.js';

describe('estimation perf', () => {
  it('calcule vues, likes et clics à partir du réseau', () => {
    const perf = estimatePerf(100_000, 5, 'ig', () => 0.5);
    expect(perf.views).toBe(Math.round(100_000 * 0.3 * 1));
    expect(perf.likes).toBe(Math.round(((perf.views * 5) / 100) * 0.8));
    expect(perf.clicks).toBe(Math.round(perf.views * 0.012));
  });
});
