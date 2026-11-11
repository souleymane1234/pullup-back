import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import express from 'express';
import type { INestApplication } from '@nestjs/common';
// import { RedisStore } from 'connect-redis';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { json, raw } from 'express';
import session from 'express-session';
import helmet from 'helmet';
import { EnvService } from '../config/env.service.js';
import { HttpExceptionFilter } from '../common/http/http-exception.filter.js';
import { requestLogger } from '../common/logging/request-logger.middleware.js';
import { rateLimitMiddleware } from '../common/http/rate-limit.middleware.js';
import { RedisService } from '../infrastructure/redis/redis.service.js';

export async function configureApp(app: INestApplication): Promise<void> {
  const env = app.get(EnvService);
  const redis = app.get(RedisService);
  const production = env.production;
  // Nginx termine le HTTPS. Sans ça, le cookie Secure n'est jamais envoyé au navigateur.
  if (production) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.setGlobalPrefix('api');
  const swaggerUiPath = dirname(
    createRequire(import.meta.url).resolve('swagger-ui-dist/package.json'),
  );
  app.use(
    '/api/docs/assets',
    express.static(swaggerUiPath, { index: false, maxAge: '7d' }),
  );
  app.use(requestLogger);
  app.use(cookieParser(env.get('SESSION_SECRET')));
  const capturePaymentBody = (
    req: Request,
    _res: Response,
    next: NextFunction,
  ) => {
    req.rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(JSON.stringify(req.body ?? {}));
    const text = req.rawBody.toString('utf8') || '';
    const type = String(req.headers['content-type'] ?? '');
    try {
      if (type.includes('application/x-www-form-urlencoded')) {
        req.body = Object.fromEntries(new URLSearchParams(text));
      } else {
        req.body = JSON.parse(text || '{}');
      }
    } catch {
      req.body = {};
    }
    next();
  };
  app.use(
    '/api/payments/webhook',
    raw({ type: '*/*', limit: '200kb' }),
    capturePaymentBody,
  );
  app.use(
    '/api/payments/callback',
    raw({ type: '*/*', limit: '200kb' }),
    capturePaymentBody,
  );
  app.use('/api/auth/signup/influencer', json({ limit: '3mb' }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (
      req.method === 'PUT' &&
      /^\/api\/influencers\/[^/]+\/photo$/.test(
        req.originalUrl.split('?')[0] ?? '',
      )
    ) {
      return json({ limit: '3mb' })(req, res, next);
    }
    next();
  });
  app.use(json({ limit: '100kb' }));
  app.use(
    helmet({
      // Le front (port 6010) et l'API (port 6000) sont deux origines.
      // same-origin bloque les réponses dans le navigateur.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: production
        ? {
            directives: {
              defaultSrc: ["'self'"],
              frameAncestors: ["'none'"],
              objectSrc: ["'none'"],
            },
          }
        : false,
      hsts: production
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.enableCors({
    origin: env.get('FRONT_ORIGIN'),
    credentials: true,
    allowedHeaders: ['Content-Type', 'X-Requested-With'],
  });

  // Sessions en mémoire tant que Redis est commenté.
  // const store = redis.raw()
  //   ? new RedisStore({ client: redis.raw()!, prefix: 'sess:' })
  //   : undefined;
  const store = undefined;

  app.use(
    session({
      name: 'pullup.sid',
      secret: env.get('SESSION_SECRET'),
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        httpOnly: true,
        secure: production,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(rateLimitMiddleware(redis));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path;
    if (
      path.startsWith('/api/metrics') ||
      path === '/api/docs' ||
      path === '/api/docs/swagger-init.js' ||
      path.startsWith('/api/docs/assets')
    ) {
      return next();
    }
    res.type('application/json; charset=utf-8');
    next();
  });
}
