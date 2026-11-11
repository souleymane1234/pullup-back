import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Role } from '../../modules/auth/domain/session.js';
import { ROLES } from '../decorators/roles.decorator.js';
import { forbidden } from '../http/app.error.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const role = request.auth?.role ?? request.session?.role;
    if (!role || !roles.includes(role)) {
      throw forbidden();
    }
    return true;
  }
}
