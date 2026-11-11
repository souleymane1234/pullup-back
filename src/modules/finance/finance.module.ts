import { Global, Module } from '@nestjs/common';
import { EnvService } from '../../config/env.service.js';
import { CallbackController } from './controller/callback.controller.js';
import { WebhookController } from './controller/webhook.controller.js';
import { FinanceEvents } from './domain/events.js';
import { CentralApisProvider } from './payment/central-apis.provider.js';
import { CENTRAL_APIS } from './payment/central-apis.js';
import { CinetPayProvider } from './payment/cinetpay.provider.js';
import { FakeProvider } from './payment/fake.provider.js';
import { PAYMENT, type PaymentProvider } from './payment/payment.port.js';
import { FinanceQueue } from './service/finance-queue.js';
import { FinanceScheduler } from './service/finance.scheduler.js';
import { LedgerService } from './service/ledger.service.js';
import { PaymentsService } from './service/payments.service.js';
import { ReconcileService } from './service/reconcile.service.js';

function buildProvider(env: EnvService): PaymentProvider {
  const name = env.get('PAYMENT_PROVIDER');
  if (name === CENTRAL_APIS) {
    return new CentralApisProvider(env);
  }
  const demo =
    env.get('DEMO_MODE') ||
    env.get('NODE_ENV') === 'test' ||
    !env.get('PAYMENT_API_KEY');
  if (name === 'fake' || demo) {
    return new FakeProvider(
      env.get('PAYMENT_WEBHOOK_SECRET') || 'dev-webhook-secret',
    );
  }
  return new CinetPayProvider(env);
}

@Global()
@Module({
  controllers: [WebhookController, CallbackController],
  providers: [
    FinanceEvents,
    FinanceQueue,
    LedgerService,
    PaymentsService,
    ReconcileService,
    FinanceScheduler,
    {
      provide: PAYMENT,
      useFactory: (env: EnvService) => buildProvider(env),
      inject: [EnvService],
    },
  ],
  exports: [
    LedgerService,
    PaymentsService,
    FinanceEvents,
    PAYMENT,
    ReconcileService,
  ],
})
export class FinanceModule {}
