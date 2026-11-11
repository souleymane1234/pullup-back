import { Injectable } from '@nestjs/common';
import { parseEnv, type AppEnv } from './env.js';

@Injectable()
export class EnvService {
  private readonly env: AppEnv;

  constructor() {
    this.env = parseEnv(process.env);
  }

  get<K extends keyof AppEnv>(key: K): AppEnv[K] {
    return this.env[key];
  }

  get production(): boolean {
    return this.env.NODE_ENV === 'production';
  }
}
