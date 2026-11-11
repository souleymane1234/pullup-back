import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module.js';
import { InfluencersModule } from '../influencers/influencers.module.js';
import { ReferencesModule } from '../references/references.module.js';
import { CampaignsController } from './controller/campaigns.controller.js';
import { CampaignLifecycleService } from './service/campaign-lifecycle.service.js';
import { CampaignsScheduler } from './service/campaigns.scheduler.js';
import { CampaignsService } from './service/campaigns.service.js';
import { UploadService } from './service/upload.service.js';

@Module({
  imports: [AuditModule, InfluencersModule, ReferencesModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    CampaignLifecycleService,
    CampaignsScheduler,
    UploadService,
  ],
  exports: [CampaignsService, CampaignLifecycleService],
})
export class CampaignsModule {}
