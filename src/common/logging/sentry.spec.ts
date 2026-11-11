import { afterEach, vi } from 'vitest';

const init = vi.fn();
const setupExpressErrorHandler = vi.fn();

vi.mock('@sentry/node', () => ({
  init,
  setupExpressErrorHandler,
}));

describe('Sentry', () => {
  afterEach(() => {
    init.mockClear();
    setupExpressErrorHandler.mockClear();
  });

  it('ne s’initialise pas sans DSN', async () => {
    const { initSentry } = await import('./sentry.js');
    await expect(initSentry('', 'development')).resolves.toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it('active Sentry quand un DSN est fourni', async () => {
    const { initSentry } = await import('./sentry.js');
    await expect(
      initSentry('https://key@o0.ingest.sentry.io/1', 'production'),
    ).resolves.toBe(true);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@o0.ingest.sentry.io/1',
        tracesSampleRate: 0.2,
        sendDefaultPii: false,
      }),
    );
  });
});
