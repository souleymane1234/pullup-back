import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator.js';
import { UNAVAILABLE_MESSAGE } from '../../../common/http/app.error.js';
import { HealthService } from '../service/health.service.js';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async livenessAndReadiness() {
    const checks = await this.health.check();
    if (!checks.ready) {
      throw new ServiceUnavailableException(UNAVAILABLE_MESSAGE);
    }
    return checks;
  }
}
