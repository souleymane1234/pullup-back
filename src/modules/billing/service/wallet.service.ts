import { randomInt } from 'node:crypto';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { formatFcfa } from '../../../common/format.js';
import { AppError, forbidden } from '../../../common/http/app.error.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { EnvService } from '../../../config/env.service.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import type { FinanceEvent } from '../../finance/domain/events.js';
import { FinanceEvents } from '../../finance/domain/events.js';
import { LedgerService } from '../../finance/service/ledger.service.js';
import { PaymentsService } from '../../finance/service/payments.service.js';
import {
  asStringList,
  assertWithdrawAmount,
  assertWithdrawOperator,
  assertWithdrawPhone,
  CODE_BAD_MESSAGE,
  CODE_SENT_MESSAGE,
  KYC_MESSAGE,
  LIMIT_MESSAGE,
  startOfUtcDay,
  UNVERIFIED_MESSAGE,
  withdrawLabel,
  withdrawSentMessage,
} from '../domain/withdraw.js';
import type { WithdrawDto } from '../dto/billing.dto.js';

const COUNTED = ['pending', 'sent'] as const;

@Injectable()
export class WalletService implements OnModuleInit, OnModuleDestroy {
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly events: FinanceEvents,
    private readonly redis: RedisService,
    private readonly env: EnvService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
  ) {}

  onModuleInit(): void {
    this.offs.push(
      this.events.on('payout.sent', (event) => this.onPayoutSent(event)),
    );
    this.offs.push(
      this.events.on('payout.failed', (event) => this.onPayoutFailed(event)),
    );
  }

  onModuleDestroy(): void {
    for (const off of this.offs) {
      off();
    }
  }

  async withdraw(auth: AuthContext, dto: WithdrawDto) {
    if (auth.role !== 'influencer') {
      throw forbidden();
    }
    const amount = assertWithdrawAmount(dto.amount);
    const operator = assertWithdrawOperator(dto.operator);
    const { phone, digits } = assertWithdrawPhone(dto.phone);
    const influencer = await this.db.influencer.findUnique({
      where: { id: auth.profileId },
    });
    if (!influencer) {
      throw new AppError('Profil introuvable.', 404);
    }
    if (!influencer.verified) {
      throw new AppError(UNVERIFIED_MESSAGE, 403);
    }
    await this.assertLimits(influencer.id, influencer.kycStatus, amount);
    await this.assertPhoneTrust(
      influencer.id,
      digits,
      asStringList(influencer.trustedPhones),
      dto.code,
    );
    const label = withdrawLabel(operator);
    const created = await this.db.$transaction(async (tx) =>
      this.reserve(tx, influencer.id, amount, operator, phone, label),
    );
    try {
      await this.payments.dispatchPayout(created.payout);
    } catch {
      await this.db.withdrawal.updateMany({
        where: { id: created.withdrawal.id, status: 'pending' },
        data: { status: 'failed' },
      });
    }
    const trusted = asStringList(influencer.trustedPhones);
    if (!trusted.includes(digits)) {
      await this.db.influencer.update({
        where: { id: influencer.id },
        data: { trustedPhones: [...trusted, digits] },
      });
    }
    return { message: withdrawSentMessage(amount, operator, formatFcfa) };
  }

  async onPayoutSent(event: FinanceEvent) {
    await this.db.withdrawal.updateMany({
      where: { payoutId: event.id, status: 'pending' },
      data: { status: 'sent' },
    });
  }

  async onPayoutFailed(event: FinanceEvent) {
    const updated = await this.db.withdrawal.updateMany({
      where: { payoutId: event.id, status: 'pending' },
      data: { status: 'failed' },
    });
    if (updated.count === 0) {
      return;
    }
    await this.notify.notify(
      event.targetId,
      `Votre retrait de ${formatFcfa(event.amount)} a échoué : le montant est de retour sur votre solde.`,
      '/me?tab=wallet',
    );
  }

  private async reserve(
    tx: Prisma.TransactionClient,
    influencerId: string,
    amount: number,
    operator: 'om' | 'mtn' | 'moov' | 'wave',
    phone: string,
    label: string,
  ) {
    await this.ledger.walletToPayout(influencerId, amount, label, tx);
    const payout = await tx.payout.create({
      data: {
        purpose: 'withdrawal',
        targetId: influencerId,
        amountFcfa: amount,
        operator,
        phone,
        status: 'pending',
        rawPayload: {},
      },
    });
    const withdrawal = await tx.withdrawal.create({
      data: {
        influencerId,
        amountFcfa: amount,
        operator,
        phone,
        payoutId: payout.id,
        status: 'pending',
      },
    });
    return { payout, withdrawal };
  }

  private async assertLimits(
    influencerId: string,
    kycStatus: string,
    amount: number,
  ) {
    const counted = { influencerId, status: { in: [...COUNTED] } };
    const [lifetime, today] = await Promise.all([
      this.db.withdrawal.aggregate({
        where: counted,
        _sum: { amountFcfa: true },
      }),
      this.db.withdrawal.findMany({
        where: { ...counted, createdAt: { gte: startOfUtcDay() } },
        select: { amountFcfa: true },
      }),
    ]);
    const dailyCount = this.env.get('WITHDRAW_DAILY_COUNT');
    const dailyFcfa = this.env.get('WITHDRAW_DAILY_FCFA');
    const todaySum = today.reduce((sum, row) => sum + row.amountFcfa, 0);
    if (today.length >= dailyCount || todaySum + amount > dailyFcfa) {
      throw new AppError(LIMIT_MESSAGE, 422);
    }
    const kycLimit = this.env.get('WITHDRAW_KYC_FCFA');
    if (
      (lifetime._sum.amountFcfa ?? 0) + amount > kycLimit &&
      kycStatus !== 'verified'
    ) {
      throw new AppError(KYC_MESSAGE, 422);
    }
  }

  private async assertPhoneTrust(
    influencerId: string,
    digits: string,
    trusted: string[],
    code?: string,
  ) {
    if (this.skipSms() || trusted.includes(digits)) {
      return;
    }
    const known = await this.db.withdrawal.findFirst({
      where: {
        influencerId,
        phone: { contains: digits.slice(-8) },
        status: { in: [...COUNTED] },
      },
    });
    if (known) {
      return;
    }
    const key = `withdraw:sms:${influencerId}:${digits}`;
    const stored = await this.redis.get(key);
    if (!code) {
      if (!stored) {
        const next = String(randomInt(100000, 1000000));
        await this.redis.set(key, next, 600);
        await this.notify.notify(
          influencerId,
          `Code PULLUP : ${next}. Validez votre numéro pour le retrait.`,
          '/me?tab=wallet',
        );
      }
      throw new AppError(CODE_SENT_MESSAGE, 422);
    }
    if (code !== stored) {
      throw new AppError(CODE_BAD_MESSAGE, 422);
    }
    await this.redis.del(key);
  }

  private skipSms(): boolean {
    return this.env.get('DEMO_MODE') || this.env.get('NODE_ENV') === 'test';
  }
}
