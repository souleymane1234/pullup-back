import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { FeatureGuard } from '../src/common/guards/feature.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { AppError } from '../src/common/http/app.error.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { FEATURE_DISABLED } from '../src/modules/platform/domain/flags.js';
import { FlagsService } from '../src/modules/platform/service/flags.service.js';
import { MatchingController } from '../src/modules/matching/controller/matching.controller.js';
import { MatchingService } from '../src/modules/matching/service/matching.service.js';

const brief = {
  theme: 'beaute',
  objective: 'notoriete',
  net: 'ig',
  budget: 100000,
  age: '',
  gender: 'all',
  city: 'Abidjan',
};

describe('matching (e2e)', () => {
  it('répond 403 si v3 est désactivée', async () => {
    const app = await matchingApp(
      {
        assertEnabled: vi
          .fn()
          .mockRejectedValue(new AppError(FEATURE_DISABLED, 403)),
      },
      { match: vi.fn() },
    );
    const response = await request(app.getHttpServer())
      .post('/api/matching')
      .send(brief)
      .expect(403);
    expect(response.body).toEqual({ message: FEATURE_DISABLED });
    await app.close();
  });

  it('renvoie un plan null pour un visiteur', async () => {
    const match = vi.fn().mockResolvedValue({ results: [], plan: null });
    const app = await matchingApp(
      { assertEnabled: vi.fn().mockResolvedValue(undefined) },
      { match },
    );
    const response = await request(app.getHttpServer())
      .post('/api/matching')
      .send(brief)
      .expect(200);
    expect(response.body).toEqual({ results: [], plan: null });
    expect(match).toHaveBeenCalled();
    await app.close();
  });
});

async function matchingApp(
  flags: { assertEnabled: unknown },
  matching: { match: unknown },
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [MatchingController],
    providers: [
      { provide: MatchingService, useValue: matching },
      { provide: FlagsService, useValue: flags },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: FeatureGuard },
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
