import '../src/test/setup-env.js';
import { Controller, Get, INestApplication, Post, Put } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { Public } from '../src/common/decorators/public.decorator.js';
import { Roles } from '../src/common/decorators/roles.decorator.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { ALL_ROLES, generatedMatrix } from '../src/common/http/role-matrix.js';
import type { Role } from '../src/modules/auth/domain/session.js';

@Controller()
class MatrixController {
  @Public()
  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('campaigns')
  list() {
    return [];
  }

  @Roles('brand')
  @Post('campaigns')
  create() {
    return { ok: true };
  }

  @Roles('brand')
  @Post('uploads/brief')
  brief() {
    return { ok: true };
  }

  @Roles('brand')
  @Put('billing/plan')
  plan() {
    return { ok: true };
  }

  @Roles('influencer')
  @Post('billing/boosts')
  boosts() {
    return { ok: true };
  }

  @Roles('influencer')
  @Post('wallet/withdrawals')
  withdraw() {
    return { ok: true };
  }

  @Roles('admin')
  @Get('admin/dashboard')
  admin() {
    return { ok: true };
  }

  @Roles('brand', 'influencer', 'admin')
  @Get('campaigns/:id/payment')
  payment() {
    return { status: 'paid' };
  }

  @Roles('brand')
  @Get('me/brand-space')
  brandSpace() {
    return { brand: {}, campaigns: [], favorites: [] };
  }

  @Roles('influencer')
  @Get('me/influencer-space')
  influencerSpace() {
    return {
      influencer: {},
      campaigns: [],
      requests: [],
      wallet: {},
      escrow: 0,
    };
  }

  @Roles('brand')
  @Put('me/brand')
  updateBrand() {
    return { message: 'Profil enregistré.' };
  }

  @Roles('brand')
  @Get('me/campaigns.csv')
  csv() {
    return 'Référence';
  }
}

const COVERED = new Set([
  '/api/health',
  '/api/campaigns',
  '/api/uploads/brief',
  '/api/billing/plan',
  '/api/billing/boosts',
  '/api/wallet/withdrawals',
  '/api/admin/dashboard',
  '/api/campaigns/:id/payment',
  '/api/me/brand-space',
  '/api/me/influencer-space',
  '/api/me/brand',
  '/api/me/campaigns.csv',
]);

describe('droits d’accès (matrice générée)', () => {
  it.each(generatedMatrix().filter((cell) => COVERED.has(cell.path)))(
    '$method $path en $role → $status',
    async (cell) => {
      const app = await matrixApp(cell.role);
      const verb = cell.method.toLowerCase() as 'get' | 'post' | 'put';
      const http = request(app.getHttpServer())[verb](
        cell.path.replace(':id', 'c1'),
      );
      if (verb !== 'get') {
        http.send({});
      }
      const status = (await http).status;
      if (cell.status === 200) {
        expect([200, 201]).toContain(status);
      } else {
        expect(status).toBe(cell.status);
      }
      await app.close();
    },
  );

  it('couvre chaque rôle métier', () => {
    expect(ALL_ROLES).toEqual(['brand', 'influencer', 'admin']);
  });
});

async function matrixApp(role: Role | null): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [MatrixController],
    providers: [
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (role) {
      req.session = { userId: 'u1', role, profileId: 'p1' } as never;
    }
    next();
  });
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
