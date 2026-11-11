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
import { AdminController } from '../src/modules/admin/controller/admin.controller.js';
import { AdminService } from '../src/modules/admin/service/admin.service.js';

const FORBIDDEN = { message: 'Action non autorisée pour ce compte.' };

describe('administration (e2e)', () => {
  it.each([
    ['get', '/api/admin/dashboard'],
    ['post', '/api/admin/influencers/i1/verify'],
    ['post', '/api/admin/influencers/i1/reject'],
    ['post', '/api/admin/influencers/i1/suspend'],
    ['put', '/api/admin/influencers/i1/scores'],
    ['post', '/api/admin/influencers/i1/certify'],
    ['get', '/api/admin/finance/summary'],
    ['get', '/api/admin/finance/ledger.csv'],
    ['get', '/api/admin/withdrawals'],
    ['get', '/api/admin/audit'],
    ['post', '/api/admin/brands/b1/credit'],
  ] as const)('un non-admin reçoit 403 sur %s %s', async (method, path) => {
    const app = await adminApp('brand');
    const agent = request(app.getHttpServer());
    const response =
      method === 'get'
        ? await agent.get(path)
        : method === 'put'
          ? await agent.put(path).send({ auth: 90 })
          : await agent.post(path).send({ reason: 'x', amount: 1000 });
    expect(response.status).toBe(403);
    expect(response.body).toEqual(FORBIDDEN);
    await app.close();
  });

  it('livre le tableau de bord à un admin', async () => {
    const dashboard = vi.fn().mockResolvedValue({
      campaigns: [],
      influencers: [],
      brands: [],
      flags: { v2: true, v3: true },
    });
    const app = await adminApp('admin', { dashboard });
    const response = await request(app.getHttpServer())
      .get('/api/admin/dashboard')
      .expect(200);
    expect(response.body.flags).toEqual({ v2: true, v3: true });
    await app.close();
  });
});

async function adminApp(
  role: 'brand' | 'admin',
  admin: Record<string, unknown> = {},
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminController],
    providers: [
      { provide: AdminService, useValue: admin },
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
