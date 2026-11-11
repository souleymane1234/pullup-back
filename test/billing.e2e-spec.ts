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
import { BillingController } from '../src/modules/billing/controller/billing.controller.js';
import { WalletController } from '../src/modules/billing/controller/wallet.controller.js';
import { BillingService } from '../src/modules/billing/service/billing.service.js';
import { WalletService } from '../src/modules/billing/service/wallet.service.js';
import { AMOUNT_MESSAGE } from '../src/modules/billing/domain/withdraw.js';
import { UNKNOWN_PLAN } from '../src/modules/billing/domain/plans.js';

describe('portefeuille et facturation (e2e)', () => {
  it('refuse un retrait au mauvais montant', async () => {
    const { AppError } = await import('../src/common/http/app.error.js');
    const app = await billingApp(
      { userId: 'u2', role: 'influencer', profileId: 'i1' },
      {
        withdraw: vi.fn().mockRejectedValue(new AppError(AMOUNT_MESSAGE, 422)),
      },
      {},
    );
    const response = await request(app.getHttpServer())
      .post('/api/wallet/withdrawals')
      .send({ amount: 900, operator: 'om', phone: '0700000000' })
      .expect(422);
    expect(response.body).toEqual({ message: AMOUNT_MESSAGE });
    await app.close();
  });

  it('refuse une formule inconnue', async () => {
    const { AppError } = await import('../src/common/http/app.error.js');
    const app = await billingApp(
      { userId: 'u1', role: 'brand', profileId: 'b1' },
      {},
      {
        setPlan: vi.fn().mockRejectedValue(new AppError(UNKNOWN_PLAN, 422)),
      },
    );
    const response = await request(app.getHttpServer())
      .put('/api/billing/plan')
      .send({ plan: 'gold' })
      .expect(422);
    expect(response.body).toEqual({ message: UNKNOWN_PLAN });
    await app.close();
  });

  it('accepte un boost par libellé', async () => {
    const purchaseBoost = vi.fn().mockResolvedValue({
      message: 'Option Influenceur Pro activée pour 30 jours.',
      status: 'active',
    });
    const app = await billingApp(
      { userId: 'u2', role: 'influencer', profileId: 'i1' },
      {},
      { purchaseBoost },
    );
    const response = await request(app.getHttpServer())
      .post('/api/billing/boosts')
      .send({ label: 'Influenceur Pro' })
      .expect(200);
    expect(response.body.message).toMatch(/Influenceur Pro/);
    expect(purchaseBoost).toHaveBeenCalled();
    await app.close();
  });
});

async function billingApp(
  session: Record<string, string>,
  wallet: Record<string, unknown>,
  billing: Record<string, unknown>,
) {
  const moduleRef = await Test.createTestingModule({
    controllers: [WalletController, BillingController],
    providers: [
      { provide: WalletService, useValue: wallet },
      { provide: BillingService, useValue: billing },
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
