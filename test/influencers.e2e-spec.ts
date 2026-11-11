import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { AppError } from '../src/common/http/app.error.js';
import { InfluencersController } from '../src/modules/influencers/controller/influencers.controller.js';
import { InfluencersService } from '../src/modules/influencers/service/influencers.service.js';

describe('influenceurs (e2e)', () => {
  it('renvoie null (200) pour une vitrine inconnue', async () => {
    const app = await publicApp({
      profile: vi.fn().mockResolvedValue(null),
    });
    const response = await request(app.getHttpServer())
      .get('/api/influencers/inconnu')
      .expect(200);
    expect(response.body).toBeNull();
    await app.close();
  });

  it('refuse le favori sans compte annonceur', async () => {
    const app = await publicApp({
      toggleFavorite: vi
        .fn()
        .mockRejectedValue(
          new AppError(
            "Connectez-vous en tant qu'annonceur pour créer votre sélection.",
            403,
          ),
        ),
    });
    const response = await request(app.getHttpServer())
      .post('/api/influencers/i1/favorite')
      .expect(403);
    expect(response.body).toEqual({
      message:
        "Connectez-vous en tant qu'annonceur pour créer votre sélection.",
    });
    await app.close();
  });
});

async function publicApp(
  service: Record<string, unknown>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [InfluencersController],
    providers: [
      { provide: InfluencersService, useValue: service },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.session = {} as never;
    next();
  });
  await app.init();
  return app;
}
