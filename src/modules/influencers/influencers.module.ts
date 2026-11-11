import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { InfluencersController } from './controller/influencers.controller.js';
import { InfluencersService } from './service/influencers.service.js';

@Module({
  imports: [AuditModule],
  controllers: [InfluencersController],
  providers: [InfluencersService],
  exports: [InfluencersService],
})
export class InfluencersModule {}
