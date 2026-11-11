import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthContext } from '../../modules/auth/domain/session.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.auth!;
  },
);

export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthContext | undefined => {
    return ctx.switchToHttp().getRequest<Request>().auth;
  },
);
