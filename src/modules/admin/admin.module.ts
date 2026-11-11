import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { CampaignsModule } from '../campaigns/campaigns.module.js';
import { InfluencersModule } from '../influencers/influencers.module.js';
import { AdminController } from './controller/admin.controller.js';
import { AdminService } from './service/admin.service.js';

@Module({
  imports: [AuditModule, CampaignsModule, InfluencersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
