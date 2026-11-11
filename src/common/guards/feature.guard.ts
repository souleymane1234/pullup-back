import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_FLAG } from '../decorators/require-flag.decorator.js';
import type { FlagKey } from '../../modules/platform/domain/flags.js';
import { FlagsService } from '../../modules/platform/service/flags.service.js';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly flags: FlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<FlagKey>(REQUIRE_FLAG, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!key) {
      return true;
    }
    await this.flags.assertEnabled(key);
    return true;
  }
}
