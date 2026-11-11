import { Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { PaymentsService } from '../service/payments.service.js';

@Controller('payments/webhook')
export class WebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':provider')
  @Public()
  @HttpCode(200)
  async receive(@Param('provider') provider: string, @Req() req: Request) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const payload = (
      typeof req.body === 'object' && req.body ? req.body : {}
    ) as Record<string, unknown>;
    return this.payments.handleWebhook(provider, headersOf(req), raw, payload);
  }
}

function headersOf(req: Request): Record<string, string> {
  return Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value[0]! : (value ?? ''),
    ]),
  );
}
