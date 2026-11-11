import '../src/test/setup-env.js';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { FeatureGuard } from '../src/common/guards/feature.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { FlagsService } from '../src/modules/platform/service/flags.service.js';
import { SpacesController } from '../src/modules/spaces/controller/spaces.controller.js';
import { SpacesService } from '../src/modules/spaces/service/spaces.service.js';

describe('espaces (e2e)', () => {
  it('refuse un influenceur sur l’espace marque', async () => {
    const app = await spacesApp(
      { userId: 'u2', role: 'influencer', profileId: 'i1' },
      { brandSpace: vi.fn() },
    );
    const response = await request(app.getHttpServer())
      .get('/api/me/brand-space')
      .expect(403);
    expect(response.body).toEqual({
      message: 'Action non autorisée pour ce compte.',
    });
    await app.close();
  });

  it('refuse un annonceur sur l’espace influenceur', async () => {
    const app = await spacesApp(
      { userId: 'u1', role: 'brand', profileId: 'b1' },
      { influencerSpace: vi.fn() },
    );
    const response = await request(app.getHttpServer())
      .get('/api/me/influencer-space')
      .expect(403);
    expect(response.body).toEqual({
      message: 'Action non autorisée pour ce compte.',
    });
    await app.close();
  });

  it('charge l’espace marque en un appel', async () => {
    const payload = {
      brand: { id: 'b1', name: 'Savane' },
      campaigns: [],
      favorites: [],
    };
    const brandSpace = vi.fn().mockResolvedValue(payload);
    const app = await spacesApp(
      { userId: 'u1', role: 'brand', profileId: 'b1' },
      { brandSpace },
    );
    const response = await request(app.getHttpServer())
      .get('/api/me/brand-space')
      .expect(200);
    expect(response.body).toEqual(payload);
    expect(brandSpace).toHaveBeenCalledTimes(1);
    await app.close();
  });
});

async function spacesApp(
  session: Record<string, string>,
  spaces: Record<string, unknown>,
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [SpacesController],
    providers: [
      { provide: SpacesService, useValue: spaces },
      { provide: FlagsService, useValue: { assertEnabled: vi.fn() } },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: FeatureGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.session = session as never;
    next();
  });
  await app.init();
  return app;
}
