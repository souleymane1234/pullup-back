import { Injectable, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';
import { AppError } from './app.error.js';

@Injectable()
export class ZodPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ??
        'Les données envoyées sont invalides.';
      throw new AppError(message, 400);
    }
    return parsed.data;
  }
}
