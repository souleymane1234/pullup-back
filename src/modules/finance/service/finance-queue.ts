import { Injectable, Logger } from '@nestjs/common';
import { noteQueueDepth } from '../../../common/metrics/alerts.js';
import { observeQueue } from '../../../common/metrics/metrics.js';

@Injectable()
export class FinanceQueue {
  private readonly logger = new Logger(FinanceQueue.name);
  private pending = 0;

  enqueue(label: string, work: () => Promise<void>): void {
    this.pending += 1;
    observeQueue(1);
    if (this.pending > 20) {
      noteQueueDepth(this.pending);
    }
    setImmediate(() => {
      work()
        .catch((error) => this.logger.error(`${label} : ${String(error)}`))
        .finally(() => {
          this.pending = Math.max(0, this.pending - 1);
          observeQueue(-1);
        });
    });
  }
}
