import type { INestApplication } from '@nestjs/common';
import { logger } from './logger.js';

export async function initSentry(
  dsn: string,
  environment: string,
): Promise<boolean> {
  if (!dsn) {
    return false;
  }
  const Sentry = await import('@sentry/node');
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.2 : 1,
    sendDefaultPii: false,
  });
  logger.info({ msg: 'sentry', enabled: true, environment });
  return true;
}

export async function attachSentry(
  app: INestApplication,
  dsn: string,
): Promise<void> {
  if (!dsn) {
    return;
  }
  const Sentry = await import('@sentry/node');
  const http = app.getHttpAdapter().getInstance() as {
    use: (...args: unknown[]) => void;
  };
  Sentry.setupExpressErrorHandler(http);
}
