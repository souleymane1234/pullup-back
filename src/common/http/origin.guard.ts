import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { EnvService } from '../../config/env.service.js';
import { AppError } from './app.error.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!request || !MUTATING.has(request.method)) {
      return true;
    }
    const path = request.originalUrl.split('?')[0] ?? '';
    if (
      path.includes('/payments/webhook/') ||
      path === '/api/payments/callback'
    ) {
      return true;
    }
    const origin = request.headers.origin;
    if (!origin) {
      return true;
    }
    if (origin !== this.env.get('FRONT_ORIGIN')) {
      throw new AppError('Origine non autorisée.', 403);
    }
    return true;
  }
}
