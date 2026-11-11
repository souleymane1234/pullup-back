import { Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../../common/decorators/public.decorator.js';
import { CENTRAL_APIS, hasCallbackIdentity } from '../payment/central-apis.js';
import { PaymentsService } from '../service/payments.service.js';

@Controller('payments/callback')
export class CallbackController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Public()
  @HttpCode(200)
  ping(@Req() req: Request) {
    return this.receive(req);
  }

  @Post()
  @Public()
  @HttpCode(200)
  async receive(@Req() req: Request) {
    const payload = payloadOf(req);
    if (!hasCallbackIdentity(payload)) {
      return { ok: true };
    }
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(payload));
    return this.payments.handleWebhook(
      CENTRAL_APIS,
      headersOf(req),
      raw,
      payload,
    );
  }
}

export function headersOf(req: Request): Record<string, string> {
  const headers = Object.fromEntries(
    Object.entries(req.headers).map(([key, value]) => [
      key.toLowerCase(),
      Array.isArray(value) ? value[0]! : (value ?? ''),
    ]),
  );
  const token = String(req.query.token ?? headers['x-callback-token'] ?? '');
  if (token) {
    headers['x-callback-token'] = token;
  }
  return headers;
}

function payloadOf(req: Request): Record<string, unknown> {
  const query = Object.fromEntries(
    Object.entries(req.query).filter(([key]) => key !== 'token'),
  ) as Record<string, unknown>;
  const body =
    typeof req.body === 'object' && req.body && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {};
  return { ...query, ...body };
}
