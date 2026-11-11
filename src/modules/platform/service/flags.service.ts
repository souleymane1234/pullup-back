import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/http/app.error.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { AuditService } from '../../audit/service/audit.service.js';
import {
  FEATURE_DISABLED,
  assertFlagKey,
  defaultFlags,
  flagMessage,
  type FlagKey,
} from '../domain/flags.js';
import { FlagsRepository } from '../repository/flags.repository.js';

const CACHE_KEY = 'flags';
const CACHE_TTL = 30;

@Injectable()
export class FlagsService {
  constructor(
    private readonly flags: FlagsRepository,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<Record<FlagKey, boolean>> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) {
      try {
        return { ...defaultFlags(), ...JSON.parse(cached) };
      } catch {
        await this.redis.del(CACHE_KEY);
      }
    }
    const flags = await this.flags.list();
    await this.redis.set(CACHE_KEY, JSON.stringify(flags), CACHE_TTL);
    return flags;
  }

  async isEnabled(key: FlagKey): Promise<boolean> {
    const flags = await this.list();
    return flags[key];
  }

  async assertEnabled(key: FlagKey): Promise<void> {
    if (!(await this.isEnabled(key))) {
      throw new AppError(FEATURE_DISABLED, 403);
    }
  }

  async set(key: string, value: boolean, actorUserId: string) {
    const flag = assertFlagKey(key);
    await this.flags.upsert(flag, value, actorUserId);
    await this.redis.del(CACHE_KEY);
    await this.audit.record({
      actorUserId,
      action: 'update_flag',
      targetType: 'FeatureFlag',
      targetId: flag,
      data: { value },
    });
    return { message: flagMessage(flag, value) };
  }
}
