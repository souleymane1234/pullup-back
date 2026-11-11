import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { BillingService } from './billing.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class BillingScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BillingScheduler.name);
  private night: NodeJS.Timeout | null = null;

  constructor(private readonly billing: BillingService) {}

  onModuleInit(): void {
    this.night = setInterval(() => {
      void this.billing
        .tick()
        .catch((error) => this.logger.error(String(error)));
    }, DAY_MS);
  }

  onModuleDestroy(): void {
    if (this.night) {
      clearInterval(this.night);
    }
  }
}
