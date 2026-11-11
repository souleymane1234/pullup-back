import { assertSeedAllowed } from './seed-guard.js';

describe('seed:reset', () => {
  it('refuse NODE_ENV=production', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(
      'Le seed de démonstration est refusé en production.',
    );
  });

  it('autorise le développement', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).not.toThrow();
  });
});
