import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { EnvService } from '../../config/env.service.js';

interface MemoryItem {
  value: string;
  expiresAt: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly memory = new Map<string, MemoryItem>();
  private client: Redis | null = null;

  constructor(private readonly env: EnvService) {}

  raw(): Redis | null {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    // Redis commenté pour l'instant. Cache, quotas et sessions restent en mémoire.
    this.logger.log('Redis commenté : fonctionnement en mémoire.');
    void this.env;
    // const redis = new Redis(this.env.get('REDIS_URL'), {
    //   maxRetriesPerRequest: 1,
    //   lazyConnect: true,
    //   enableOfflineQueue: false,
    // });
    // try {
    //   await redis.connect();
    //   this.client = redis;
    // } catch (error) {
    //   redis.disconnect();
    //   this.logger.error(`Redis indisponible : ${String(error)}`);
    // }
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.disconnect();
    this.client = null;
  }

  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }
    return (await this.client.ping()) === 'PONG';
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      return this.client.get(key);
    }
    const current = this.memory.get(key);
    if (!current || current.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return current.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (this.client) {
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, value, 'EX', ttlSeconds);
        return;
      }
      await this.client.set(key, value);
      return;
    }
    this.memory.set(key, {
      value,
      expiresAt:
        Date.now() +
        (ttlSeconds && ttlSeconds > 0 ? ttlSeconds * 1000 : 86_400_000),
    });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    if (this.client) {
      const value = await this.client.incr(key);
      if (value === 1) {
        await this.client.expire(key, ttlSeconds);
      }
      return value;
    }
    const now = Date.now();
    const current = this.memory.get(key);
    if (!current || current.expiresAt <= now) {
      this.memory.set(key, { value: '1', expiresAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(current.value) + 1;
    current.value = String(next);
    return next;
  }

  async del(key: string): Promise<void> {
    if (this.client) {
      await this.client.del(key);
      return;
    }
    this.memory.delete(key);
  }
}
