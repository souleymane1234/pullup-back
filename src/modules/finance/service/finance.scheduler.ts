import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { ReconcileService } from './reconcile.service.js';

const FIVE_MIN = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class FinanceScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FinanceScheduler.name);
  private poll: NodeJS.Timeout | null = null;
  private night: NodeJS.Timeout | null = null;

  constructor(
    private readonly payments: PaymentsService,
    private readonly reconcile: ReconcileService,
  ) {}

  onModuleInit(): void {
    this.poll = setInterval(() => {
      void this.payments
        .pollPending()
        .catch((error) => this.logger.error(String(error)));
    }, FIVE_MIN);
    this.night = setInterval(() => {
      void this.reconcile
        .runNightly()
        .catch((error) => this.logger.error(String(error)));
    }, DAY_MS);
  }

  onModuleDestroy(): void {
    if (this.poll) {
      clearInterval(this.poll);
    }
    if (this.night) {
      clearInterval(this.night);
    }
  }
}
