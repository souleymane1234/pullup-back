import { HttpException } from '@nestjs/common';

export class AppError extends HttpException {
  constructor(message: string, status: number) {
    super({ message }, status);
  }
}

export const UNAUTHORIZED_MESSAGE = 'Action non autorisée pour ce compte.';
export const UNAVAILABLE_MESSAGE = 'Le service est indisponible.';

export function forbidden(): AppError {
  return new AppError(UNAUTHORIZED_MESSAGE, 403);
}
