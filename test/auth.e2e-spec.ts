import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { AppError } from '../src/common/http/app.error.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { AuthController } from '../src/modules/auth/controller/auth.controller.js';
import { MeController } from '../src/modules/auth/controller/me.controller.js';
import { AuthService } from '../src/modules/auth/service/auth.service.js';

const brandSession = {
  role: 'brand',
  id: 'b1',
  name: 'Savane Cosmetics',
  email: 'marketing@savane.ci',
  contact: 'Aïcha Diomandé',
  plan: 'pro',
  avatar: { name: 'Savane Cosmetics', hue: 20 },
};

describe('authentification (e2e)', () => {
  it('GET /api/auth/session renvoie null si non connecté', async () => {
    const app = await authApp();
    const response = await request(app.getHttpServer())
      .get('/api/auth/session')
      .expect(200);
    expect(response.body).toBeNull();
    await app.close();
  });

  it('renvoie la session après connexion', async () => {
    const auth = {
      currentSession: vi.fn().mockResolvedValue(brandSession),
      login: vi.fn().mockResolvedValue({
        session: brandSession,
        message: 'Connecté : Savane Cosmetics',
      }),
    };
    const app = await authApp(auth, {
      userId: 'u1',
      role: 'brand',
      profileId: 'b1',
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'marketing@savane.ci', password: 'demo-pass' })
      .expect(200);
    expect(login.body).toEqual({
      session: brandSession,
      message: 'Connecté : Savane Cosmetics',
    });
    const session = await request(app.getHttpServer())
      .get('/api/auth/session')
      .expect(200);
    expect(session.body).toEqual(brandSession);
    await app.close();
  });

  it('POST /api/auth/demo répond 404 si DEMO_MODE=false', async () => {
    const auth = {
      demo: vi.fn().mockRejectedValue(new AppError('Introuvable.', 404)),
    };
    const app = await authApp(auth);
    const response = await request(app.getHttpServer())
      .post('/api/auth/demo')
      .send({ role: 'admin', id: 'admin' })
      .expect(404);
    expect(response.body).toEqual({ message: 'Introuvable.' });
    await app.close();
  });

  it('POST /api/auth/logout exige une session', async () => {
    const app = await authApp();
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .expect(401);
    expect(response.body).toEqual({
      message: 'Connectez-vous pour continuer.',
    });
    await app.close();
  });
});

async function authApp(
  auth: Record<string, unknown> = {},
  session?: {
    userId: string;
    role: 'brand' | 'influencer' | 'admin';
    profileId: string;
  },
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [AuthController, MeController],
    providers: [
      { provide: AuthService, useValue: { currentSession: vi.fn(), ...auth } },
      { provide: APP_GUARD, useClass: SessionGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (session) {
      req.session = session as never;
    }
    next();
  });
  await app.init();
  return app;
}
