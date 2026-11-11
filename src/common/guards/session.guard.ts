import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { AppError } from '../http/app.error.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request>();
    const userId = request.session?.userId;
    const role = request.session?.role;
    const profileId = request.session?.profileId;
    if (userId && role && profileId) {
      request.auth = { userId, role, profileId };
    }
    if (isPublic) {
      return true;
    }
    if (!request.auth) {
      throw new AppError('Connectez-vous pour continuer.', 401);
    }
    return true;
  }
}
