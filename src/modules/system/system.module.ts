import { Module } from '@nestjs/common';
import { DocsController } from './controller/docs.controller.js';
import { MetricsController } from './controller/metrics.controller.js';
import { SystemController } from './controller/system.controller.js';

@Module({
  controllers: [SystemController, DocsController, MetricsController],
})
export class SystemModule {}
