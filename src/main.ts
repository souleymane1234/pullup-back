import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap/configure-app.js';
import { attachSentry, initSentry } from './common/logging/sentry.js';
import { EnvService } from './config/env.service.js';

async function bootstrap() {
  const dsn = process.env.SENTRY_DSN ?? '';
  await initSentry(dsn, process.env.NODE_ENV ?? 'development');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = new Logger('Bootstrap');
  app.useLogger(logger);
  await configureApp(app);
  await attachSentry(app, dsn);
  const port = app.get(EnvService).get('PORT');
  await app.listen(port);
  logger.log(`PULLUP API sur /api — port ${port}`);
}

await bootstrap();
