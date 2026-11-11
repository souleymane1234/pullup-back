import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator.js';
import { renderMetrics } from '../../../common/metrics/metrics.js';

@Public()
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  metrics() {
    return renderMetrics();
  }
}
