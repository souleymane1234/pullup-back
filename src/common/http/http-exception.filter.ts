import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { UNAVAILABLE_MESSAGE } from './app.error.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : typeof body === 'object' && body && 'message' in body
            ? Array.isArray((body as { message: unknown }).message)
              ? 'Les données envoyées sont invalides.'
              : String((body as { message: unknown }).message)
            : UNAVAILABLE_MESSAGE;
      response.status(status).json({ message });
      return;
    }
    this.logger.error(exception);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ message: UNAVAILABLE_MESSAGE });
  }
}
