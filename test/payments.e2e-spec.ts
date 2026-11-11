import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { FeatureGuard } from '../src/common/guards/feature.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { AppError } from '../src/common/http/app.error.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { FlagsService } from '../src/modules/platform/service/flags.service.js';
import { CallbackController } from '../src/modules/finance/controller/callback.controller.js';
import { WebhookController } from '../src/modules/finance/controller/webhook.controller.js';
import { PaymentsService } from '../src/modules/finance/service/payments.service.js';

describe('paiements webhook (e2e)', () => {
  it('refuse une signature invalide', async () => {
    const app = await webhookApp({
      handleWebhook: vi
        .fn()
        .mockRejectedValue(new AppError('Signature invalide.', 401)),
    });
    const response = await request(app.getHttpServer())
      .post('/api/payments/webhook/fake')
      .set('x-webhook-signature', 'nope')
      .send({ cpm_trans_id: 'x' })
      .expect(401);
    expect(response.body).toEqual({ message: 'Signature invalide.' });
    await app.close();
  });

  it('ignore un événement déjà vu', async () => {
    const handleWebhook = vi
      .fn()
      .mockResolvedValue({ ok: true, duplicate: true });
    const app = await webhookApp({ handleWebhook });
    await request(app.getHttpServer())
      .post('/api/payments/webhook/fake')
      .send({ event_id: 'evt-1' })
      .expect(200);
    const again = await request(app.getHttpServer())
      .post('/api/payments/webhook/fake')
      .send({ event_id: 'evt-1' })
      .expect(200);
    expect(again.body).toEqual({ ok: true, duplicate: true });
    await app.close();
  });

  it('répond au ping GET du callback Central APIS', async () => {
    const handleWebhook = vi.fn();
    const app = await webhookApp({ handleWebhook });
    const response = await request(app.getHttpServer())
      .get('/api/payments/callback')
      .expect(200);
    expect(response.body).toEqual({ ok: true });
    expect(handleWebhook).not.toHaveBeenCalled();
    await app.close();
  });

  it('transmet un cashin Central APIS au service paiements', async () => {
    const handleWebhook = vi.fn().mockResolvedValue({ ok: true });
    const app = await webhookApp({ handleWebhook });
    await request(app.getHttpServer())
      .post('/api/payments/callback?token=test-webhook-secret')
      .send({
        transaction_id: 'TXN-1',
        reference: 'pay_1',
        status: 'SUCCESS',
        type: 'CASHIN',
        amount: 90000,
        operator: 'ORANGE',
      })
      .expect(200);
    expect(handleWebhook).toHaveBeenCalledWith(
      'central-apis',
      expect.objectContaining({ 'x-callback-token': 'test-webhook-secret' }),
      expect.any(Buffer),
      expect.objectContaining({ transaction_id: 'TXN-1', status: 'SUCCESS' }),
    );
    await app.close();
  });
});

async function webhookApp(payments: {
  handleWebhook: unknown;
}): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [WebhookController, CallbackController],
    providers: [
      { provide: PaymentsService, useValue: payments },
      { provide: FlagsService, useValue: { assertEnabled: vi.fn() } },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: FeatureGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}
