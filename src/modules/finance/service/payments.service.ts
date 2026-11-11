import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PAY } from '../../../common/catalog.js';
import { AppError } from '../../../common/http/app.error.js';
import { noteWebhookFailure } from '../../../common/metrics/alerts.js';
import { observePayment } from '../../../common/metrics/metrics.js';
import { fcfa, fcfaCapped } from '../../../common/money.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { FinanceEvents } from '../domain/events.js';
import { maskPhone } from '../domain/phone.js';
import {
  CENTRAL_APIS,
  collectStatusFromCallback,
  eventIdFromCallback,
  payoutStatusFromCallback,
  refsFromCallback,
} from '../payment/central-apis.js';
import {
  PAYMENT,
  type PayMethod,
  type PayOperator,
  type PaymentProvider,
} from '../payment/payment.port.js';
import { FinanceQueue } from './finance-queue.js';
import { LedgerService } from './ledger.service.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly events: FinanceEvents,
    private readonly queue: FinanceQueue,
    @Inject(PAYMENT) private readonly provider: PaymentProvider,
  ) {}

  async initiateCollect(input: {
    purpose: 'campaign' | 'plan' | 'boost';
    targetId: string;
    payerUserId: string;
    method: PayMethod;
    phone?: string;
    otp?: string;
    amountFcfa: number;
    fromBalanceFcfa?: number;
    description: string;
    customer: { name: string; email: string };
  }) {
    const fromBalance = fcfa(input.fromBalanceFcfa ?? 0);
    const pspAmount = fcfa(input.amountFcfa || 0);
    if (pspAmount > 0) {
      fcfaCapped(pspAmount);
    }
    this.logger.log(
      `collect ${input.purpose} ${pspAmount + fromBalance} ${input.method} ${maskPhone(input.phone)} via ${this.provider.name}`,
    );
    const payment = await this.db.payment.create({
      data: {
        purpose: input.purpose,
        targetId: input.targetId,
        payerUserId: input.payerUserId,
        method: input.method,
        phone: input.phone ?? null,
        amountFcfa: pspAmount,
        fromBalanceFcfa: fromBalance,
        provider: this.provider.name,
        status: 'pending',
        rawPayload: {},
      },
    });
    if (pspAmount === 0) {
      await this.markPayment(payment.id, 'succeeded', { fromBalance: true });
      return { paymentId: payment.id, status: 'succeeded' as const };
    }
    const started = await this.provider.initCollect({
      reference: payment.id,
      amount: pspAmount,
      method: input.method,
      phone: input.phone,
      otp: input.otp,
      description: input.description,
      customer: input.customer,
    });
    await this.db.payment.update({
      where: { id: payment.id },
      data: {
        providerRef: started.providerRef,
        rawPayload: started as unknown as Prisma.InputJsonValue,
      },
    });
    if (started.status === 'succeeded') {
      await this.completeCollect(payment.id, started.providerRef);
    }
    return {
      paymentId: payment.id,
      status: started.status,
      redirectUrl: started.redirectUrl,
      providerRef: started.providerRef,
    };
  }

  async initiatePayout(input: {
    influencerId: string;
    amountFcfa: number;
    operator: PayOperator;
    phone: string;
  }) {
    const amount = fcfaCapped(input.amountFcfa);
    this.logger.log(
      `payout ${input.influencerId} ${amount} ${input.operator} ${maskPhone(input.phone)}`,
    );
    const payout = await this.db.payout.create({
      data: {
        purpose: 'withdrawal',
        targetId: input.influencerId,
        amountFcfa: amount,
        operator: input.operator,
        phone: input.phone,
        status: 'pending',
        rawPayload: {},
      },
    });
    await this.ledger.walletToPayout(
      input.influencerId,
      amount,
      withdrawLabel(input.operator),
    );
    const started = await this.dispatchPayout(payout);
    return {
      payoutId: payout.id,
      status: started.status,
      providerRef: started.providerRef,
    };
  }

  async dispatchPayout(payout: {
    id: string;
    targetId: string;
    amountFcfa: number;
    operator: string;
    phone: string;
  }) {
    try {
      const started = await this.provider.initPayout({
        reference: payout.id,
        amount: payout.amountFcfa,
        operator: payout.operator as PayOperator,
        phone: payout.phone,
      });
      await this.db.payout.update({
        where: { id: payout.id },
        data: {
          providerRef: started.providerRef,
          status: started.status,
          rawPayload: started as unknown as Prisma.InputJsonValue,
        },
      });
      if (started.status === 'sent') {
        await this.events.emit({
          type: 'payout.sent',
          id: payout.id,
          targetId: payout.targetId,
          amount: payout.amountFcfa,
        });
      }
      return started;
    } catch (error) {
      await this.ledger.payoutFailed(
        payout.targetId,
        payout.amountFcfa,
        withdrawRefundLabel(payout.operator),
      );
      await this.db.payout.update({
        where: { id: payout.id },
        data: { status: 'failed' },
      });
      await this.events.emit({
        type: 'payout.failed',
        id: payout.id,
        targetId: payout.targetId,
        amount: payout.amountFcfa,
      });
      throw error;
    }
  }

  async handleWebhook(
    provider: string,
    headers: Record<string, string>,
    rawBody: Buffer,
    payload: Record<string, unknown>,
  ) {
    if (
      provider !== this.provider.name &&
      provider !== 'fake' &&
      provider !== CENTRAL_APIS
    ) {
      throw new AppError('Introuvable.', 404);
    }
    if (!this.provider.verifyWebhook(headers, rawBody)) {
      this.logger.warn(`Webhook ${provider} signature invalide`);
      throw new AppError('Signature invalide.', 401);
    }
    const eventId = eventIdFromCallback(payload);
    if (!eventId) {
      throw new AppError('Événement sans identifiant.', 400);
    }
    try {
      await this.db.webhookEvent.create({
        data: { provider, eventId, payload: payload as Prisma.InputJsonValue },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { ok: true, duplicate: true };
      }
      throw error;
    }
    this.queue.enqueue(`webhook:${eventId}`, () =>
      this.processWebhook(eventId),
    );
    return { ok: true };
  }

  async processWebhook(eventId: string) {
    const event = await this.db.webhookEvent.findUnique({ where: { eventId } });
    if (!event || event.processedAt) {
      return;
    }
    const payload = event.payload as Record<string, unknown>;
    const refs = refsFromCallback(payload);
    const providerRef = refs[0] ?? eventId;
    const payment = await this.db.payment.findFirst({
      where: {
        OR: [
          ...(refs.length
            ? [{ providerRef: { in: refs } }, { id: { in: refs } }]
            : []),
          { providerRef },
          { id: String(payload.paymentId ?? '') },
        ],
      },
    });
    if (payment) {
      const mapped = collectStatusFromCallback(payload);
      const status =
        mapped && this.provider.name !== CENTRAL_APIS
          ? mapped
          : await this.provider.getCollectStatus(
              payment.providerRef ?? providerRef,
            );
      if (status === 'succeeded') {
        await this.completeCollect(
          payment.id,
          payment.providerRef ?? providerRef,
          mapped === 'succeeded' && this.provider.name !== CENTRAL_APIS,
        );
      } else if (status === 'failed' || status === 'expired') {
        await this.markPayment(payment.id, status, payload);
        await this.events.emit({
          type: 'payment.failed',
          id: payment.id,
          targetId: payment.targetId,
          amount: payment.amountFcfa,
          purpose: payment.purpose,
        });
      }
    }
    const payout = await this.db.payout.findFirst({
      where: {
        OR: [
          ...(refs.length
            ? [{ providerRef: { in: refs } }, { id: { in: refs } }]
            : []),
          { providerRef },
          { id: String(payload.payoutId ?? '') },
        ],
      },
    });
    if (payout) {
      const mapped = payoutStatusFromCallback(payload);
      const status =
        mapped && this.provider.name !== CENTRAL_APIS
          ? mapped
          : await this.provider.getPayoutStatus(
              payout.providerRef ?? providerRef,
            );
      if (status === 'sent' && payout.status !== 'sent') {
        await this.db.payout.update({
          where: { id: payout.id },
          data: { status: 'sent' },
        });
        await this.events.emit({
          type: 'payout.sent',
          id: payout.id,
          targetId: payout.targetId,
          amount: payout.amountFcfa,
        });
      }
      if (status === 'failed' && payout.status !== 'failed') {
        await this.ledger.payoutFailed(
          payout.targetId,
          payout.amountFcfa,
          withdrawRefundLabel(payout.operator),
        );
        await this.db.payout.update({
          where: { id: payout.id },
          data: { status: 'failed' },
        });
        await this.events.emit({
          type: 'payout.failed',
          id: payout.id,
          targetId: payout.targetId,
          amount: payout.amountFcfa,
        });
      }
    }
    await this.db.webhookEvent.update({
      where: { eventId },
      data: { processedAt: new Date() },
    });
  }

  async pollPending(): Promise<void> {
    const tenMin = new Date(Date.now() - 10 * 60 * 1000);
    const thirtyMin = new Date(Date.now() - 30 * 60 * 1000);
    const pending = await this.db.payment.findMany({
      where: { status: 'pending', createdAt: { lte: tenMin } },
    });
    for (const payment of pending) {
      if (payment.createdAt <= thirtyMin) {
        await this.markPayment(payment.id, 'expired', { reason: 'timeout' });
        await this.events.emit({
          type: 'payment.failed',
          id: payment.id,
          targetId: payment.targetId,
          amount: payment.amountFcfa,
          purpose: payment.purpose,
        });
        continue;
      }
      if (!payment.providerRef) {
        continue;
      }
      const status = await this.provider.getCollectStatus(payment.providerRef);
      if (status === 'succeeded') {
        await this.completeCollect(payment.id, payment.providerRef);
      } else if (status === 'failed' || status === 'expired') {
        await this.markPayment(payment.id, status, { polled: true });
        await this.events.emit({
          type: 'payment.failed',
          id: payment.id,
          targetId: payment.targetId,
          amount: payment.amountFcfa,
          purpose: payment.purpose,
        });
      }
    }
  }

  private async completeCollect(
    paymentId: string,
    providerRef: string,
    trusted = false,
  ) {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment || payment.status === 'succeeded') {
      return;
    }
    if (!trusted) {
      const status = await this.provider.getCollectStatus(providerRef);
      if (status !== 'succeeded') {
        return;
      }
    }
    await this.markPayment(paymentId, 'succeeded', { providerRef });
    if (payment.purpose === 'plan' || payment.purpose === 'boost') {
      await this.ledger.collectRevenue(payment.purpose, payment.amountFcfa);
    }
    await this.events.emit({
      type: 'payment.succeeded',
      id: payment.id,
      targetId: payment.targetId,
      amount: payment.amountFcfa,
      purpose: payment.purpose,
    });
  }

  private markPayment(
    id: string,
    status: 'succeeded' | 'failed' | 'expired',
    payload: unknown,
  ) {
    observePayment(status);
    if (status === 'failed') {
      noteWebhookFailure();
    }
    return this.db.payment.update({
      where: { id },
      data: { status, rawPayload: payload as Prisma.InputJsonValue },
    });
  }
}

function withdrawLabel(operator: string): string {
  return `Retrait ${PAY[operator as keyof typeof PAY] ?? operator}`;
}

function withdrawRefundLabel(operator: string): string {
  return `${withdrawLabel(operator)} recrédité`;
}
