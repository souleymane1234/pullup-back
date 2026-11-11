import { Module } from '@nestjs/common';
import { CampaignsModule } from '../campaigns/campaigns.module.js';
import { InfluencersModule } from '../influencers/influencers.module.js';
import { SpacesController } from './controller/spaces.controller.js';
import { SpacesService } from './service/spaces.service.js';

@Module({
  imports: [CampaignsModule, InfluencersModule],
  controllers: [SpacesController],
  providers: [SpacesService],
})
export class SpacesModule {}
