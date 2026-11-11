import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CampaignLifecycleService } from './campaign-lifecycle.service.js';

const HOUR_MS = 60 * 60 * 1000;

@Injectable()
export class CampaignsScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CampaignsScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly lifecycle: CampaignLifecycleService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.lifecycle
        .runScheduledJobs()
        .catch((error) => this.logger.error(String(error)));
    }, HOUR_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }
}
