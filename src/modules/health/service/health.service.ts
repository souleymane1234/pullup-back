import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    const live = true;
    let database = false;
    let redis = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      database = true;
    } catch {
      database = false;
    }
    // Redis commenté : la readiness ne dépend plus que de MySQL.
    // redis = await this.redis.ping();
    void this.redis;
    redis = false;
    const ready = database;
    return {
      live,
      ready,
      db: database ? 'up' : 'down',
      redis: redis ? 'up' : 'down',
    };
  }
}
