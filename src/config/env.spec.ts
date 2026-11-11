import { parseEnv } from './env.js';

const valid = {
  DATABASE_URL: 'mysql://root:x@127.0.0.1:3306/pullup',
  REDIS_URL: 'redis://127.0.0.1:6379',
  SESSION_SECRET: 'session-secret-16',
  FRONT_ORIGIN: 'http://localhost:5173',
  DEMO_MODE: 'true',
};

describe('parseEnv', () => {
  it('accepte la configuration de développement', () => {
    const env = parseEnv(valid);
    expect(env.DEMO_MODE).toBe(true);
    expect(env.PORT).toBe(4000);
  });

  it('refuse DEMO_MODE en production', () => {
    expect(() =>
      parseEnv({ ...valid, NODE_ENV: 'production', DEMO_MODE: 'true' }),
    ).toThrow(/DEMO_MODE/);
  });

  it('refuse un FRONT_ORIGIN invalide', () => {
    expect(() => parseEnv({ ...valid, FRONT_ORIGIN: 'not-a-url' })).toThrow(
      /Configuration invalide/,
    );
  });
});
