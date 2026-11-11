import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/http/app.error.js';
import type { PlanKey } from '../../../common/catalog.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { InfluencersService } from '../../influencers/service/influencers.service.js';
import { rankMatches, type MatchBrief } from '../domain/matching.js';
import { applyMatchingRights, type MatchPlan } from '../domain/rights.js';
import type { MatchingBriefDto } from '../dto/matching.dto.js';

const MATCHING_LIMIT = 30;

@Injectable()
export class MatchingService {
  constructor(
    private readonly influencers: InfluencersService,
    private readonly db: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async match(
    dto: MatchingBriefDto,
    auth: AuthContext | undefined,
    ip: string,
  ) {
    await this.assertRate(ip);
    const plan = await this.planOf(auth);
    const listed = await this.influencers.listedPresented(auth);
    const brief: MatchBrief = {
      theme: dto.theme,
      objective: dto.objective,
      net: dto.net,
      budget: dto.budget,
      age: dto.age,
      gender: dto.gender,
      city: dto.city,
    };
    const ranked = rankMatches(listed, brief);
    return { results: applyMatchingRights(ranked, plan), plan };
  }

  private async planOf(auth?: AuthContext): Promise<MatchPlan> {
    if (auth?.role !== 'brand') {
      return null;
    }
    const brand = await this.db.brand.findUnique({
      where: { id: auth.profileId },
      select: { plan: true },
    });
    return (brand?.plan as PlanKey | undefined) ?? 'free';
  }

  private async assertRate(ip: string) {
    const count = await this.redis.incr(`rl:matching:${ip}`, 60);
    if (count > MATCHING_LIMIT) {
      throw new AppError('Trop de requêtes. Réessayez dans une minute.', 429);
    }
  }
}
