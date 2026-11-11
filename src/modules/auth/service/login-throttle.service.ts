import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/http/app.error.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';

const WINDOW = 15 * 60;
const MAX = 5;

@Injectable()
export class LoginThrottleService {
  constructor(private readonly redis: RedisService) {}

  async assertAllowed(ip: string, email: string): Promise<void> {
    const ipCount = Number((await this.redis.get(this.ipKey(ip))) ?? '0');
    const emailCount = Number(
      (await this.redis.get(this.emailKey(email))) ?? '0',
    );
    if (ipCount >= MAX || emailCount >= MAX) {
      throw new AppError(
        'Trop de tentatives, réessayez dans quelques minutes.',
        429,
      );
    }
  }

  async recordFailure(ip: string, email: string): Promise<void> {
    await this.redis.incr(this.ipKey(ip), WINDOW);
    await this.redis.incr(this.emailKey(email), WINDOW);
  }

  async clear(ip: string, email: string): Promise<void> {
    await this.redis.del(this.ipKey(ip));
    await this.redis.del(this.emailKey(email));
  }

  private ipKey(ip: string) {
    return `auth:fail:ip:${ip}`;
  }

  private emailKey(email: string) {
    return `auth:fail:email:${email}`;
  }
}
