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
import { AdminCatalogController } from '../src/modules/catalog/controller/admin-catalog.controller.js';
import { CatalogController } from '../src/modules/catalog/controller/catalog.controller.js';
import { CatalogService } from '../src/modules/catalog/service/catalog.service.js';

const FORBIDDEN = { message: 'Action non autorisée pour ce compte.' };

describe('catalogue (e2e)', () => {
  it.each([
    ['get', '/api/admin/catalog'],
    ['post', '/api/admin/catalog'],
    ['put', '/api/admin/catalog/category/cinema'],
    ['delete', '/api/admin/catalog/category/cinema'],
  ] as const)('un non-admin reçoit 403 sur %s %s', async (method, path) => {
    const app = await catalogApp('brand');
    const agent = request(app.getHttpServer());
    const response =
      method === 'get'
        ? await agent.get(path)
        : method === 'put'
          ? await agent.put(path).send({ label: 'Cinéma' })
          : method === 'delete'
            ? await agent.delete(path)
            : await agent.post(path).send({
                kind: 'category',
                key: 'cinema',
                label: 'Cinéma',
              });
    expect(response.status).toBe(403);
    expect(response.body).toEqual(FORBIDDEN);
    await app.close();
  });

  it('livre le catalogue public et permet à l’admin de créer', async () => {
    const publicSnapshot = vi.fn().mockResolvedValue({
      cats: { cinema: 'Cinéma & séries' },
      cities: ['Abidjan'],
    });
    const create = vi.fn().mockResolvedValue({
      message: 'Catégorie créée.',
      item: { kind: 'category', key: 'cinema', label: 'Cinéma & séries' },
    });
    const app = await catalogApp('admin', { publicSnapshot, create });
    await request(app.getHttpServer()).get('/api/catalog').expect(200);
    const created = await request(app.getHttpServer())
      .post('/api/admin/catalog')
      .send({ kind: 'category', key: 'cinema', label: 'Cinéma & séries' })
      .expect(200);
    expect(created.body.message).toBe('Catégorie créée.');
    await app.close();
  });
});

async function catalogApp(
  role: 'brand' | 'admin',
  catalog: Record<string, unknown> = {},
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [CatalogController, AdminCatalogController],
    providers: [
      { provide: CatalogService, useValue: catalog },
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
    req.session = {
      userId: 'u1',
      role,
      profileId: role === 'admin' ? 'admin' : 'b1',
    } as never;
    next();
  });
  await app.init();
  return app;
}
