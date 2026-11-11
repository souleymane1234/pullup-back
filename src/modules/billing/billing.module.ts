import { Module } from '@nestjs/common';
import { BillingController } from './controller/billing.controller.js';
import { WalletController } from './controller/wallet.controller.js';
import { BillingScheduler } from './service/billing.scheduler.js';
import { BillingService } from './service/billing.service.js';
import { WalletService } from './service/wallet.service.js';

@Module({
  controllers: [WalletController, BillingController],
  providers: [WalletService, BillingService, BillingScheduler],
  exports: [WalletService, BillingService],
})
export class BillingModule {}
