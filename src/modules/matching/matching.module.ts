import { Module } from '@nestjs/common';
import { InfluencersModule } from '../influencers/influencers.module.js';
import { MatchingController } from './controller/matching.controller.js';
import { MatchingService } from './service/matching.service.js';

@Module({
  imports: [InfluencersModule],
  controllers: [MatchingController],
  providers: [MatchingService],
})
export class MatchingModule {}
