import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { BoostKey as BoostKeyRow, Plan } from '@prisma/client';
import { PAY, type PayKey, type PlanKey } from '../../../common/catalog.js';
import { AppError, forbidden } from '../../../common/http/app.error.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { EnvService } from '../../../config/env.service.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { paymentSplit } from '../../campaigns/domain/booking.js';
import type { FinanceEvent } from '../../finance/domain/events.js';
import { FinanceEvents } from '../../finance/domain/events.js';
import type { PayMethod } from '../../finance/payment/payment.port.js';
import { LedgerService } from '../../finance/service/ledger.service.js';
import { PaymentsService } from '../../finance/service/payments.service.js';
import {
  boostActivatedMessage,
  boostPeriod,
  resolveBoost,
  type BoostKey,
} from '../domain/boosts.js';
import {
  addDays,
  AWAITING_PAYMENT,
  activatedMessage,
  assertPlan,
  GRACE_DAYS,
  periodOf,
  planLabel,
  planPrice,
  RENEWAL_NOTICE_DAYS,
} from '../domain/plans.js';
import { assertWithdrawPhone } from '../domain/withdraw.js';
import type { BoostDto, PlanDto } from '../dto/billing.dto.js';

const PAY_METHODS = Object.keys(PAY) as PayKey[];

@Injectable()
export class BillingService implements OnModuleInit, OnModuleDestroy {
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly db: PrismaService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly events: FinanceEvents,
    private readonly env: EnvService,
    private readonly redis: RedisService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
  ) {}

  onModuleInit(): void {
    this.offs.push(
      this.events.on('payment.succeeded', (event) => this.onFinance(event)),
    );
    this.offs.push(
      this.events.on('payment.failed', (event) => this.onFinance(event)),
    );
  }

  onModuleDestroy(): void {
    for (const off of this.offs) {
      off();
    }
  }

  async setPlan(auth: AuthContext, dto: PlanDto) {
    if (auth.role !== 'brand') {
      throw forbidden();
    }
    const plan = assertPlan(dto.plan);
    const brand = await this.db.brand.findUnique({
      where: { id: auth.profileId },
      include: { user: { select: { email: true } } },
    });
    if (!brand) {
      throw new AppError('Profil introuvable.', 404);
    }
    if (plan === 'free') {
      return this.downgradeToFree(brand.id, brand.plan);
    }
    const price = planPrice(plan);
    const { fromBalance, toCollect } = paymentSplit(brand.balanceFcfa, price);
    const period = periodOf();
    const subscription = await this.db.subscription.create({
      data: {
        brandId: brand.id,
        plan,
        status: 'pending',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    });
    if (fromBalance > 0) {
      await this.ledger.balanceToRevenue(
        brand.id,
        fromBalance,
        `Formule ${planLabel(plan)}`,
      );
    }
    if (toCollect === 0) {
      await this.activatePlan(subscription.id);
      return { message: activatedMessage(plan), status: 'active' as const };
    }
    const method = this.payMethod(dto.pay);
    const phone = this.collectPhone(dto.phone, method);
    const collect = await this.payments.initiateCollect({
      purpose: 'plan',
      targetId: subscription.id,
      payerUserId: auth.userId,
      method,
      phone,
      otp: dto.otp,
      amountFcfa: toCollect,
      fromBalanceFcfa: fromBalance,
      description: `Formule ${planLabel(plan)}`,
      customer: { name: brand.name, email: brand.user.email },
    });
    await this.db.subscription.update({
      where: { id: subscription.id },
      data: { paymentId: collect.paymentId },
    });
    if (collect.status === 'succeeded') {
      await this.activatePlan(subscription.id);
      return {
        message: activatedMessage(plan),
        status: 'active' as const,
        redirectUrl: collect.redirectUrl,
      };
    }
    return {
      message: AWAITING_PAYMENT,
      status: 'awaiting_payment' as const,
      redirectUrl: collect.redirectUrl,
    };
  }

  async purchaseBoost(auth: AuthContext, dto: BoostDto) {
    if (auth.role !== 'influencer') {
      throw forbidden();
    }
    const boost = resolveBoost(dto);
    const influencer = await this.db.influencer.findUnique({
      where: { id: auth.profileId },
      include: { user: { select: { email: true } } },
    });
    if (!influencer) {
      throw new AppError('Profil introuvable.', 404);
    }
    const purchase = await this.db.boostPurchase.create({
      data: {
        influencerId: influencer.id,
        boostKey: boost.key,
        amountFcfa: boost.price,
        status: 'pending',
      },
    });
    const method = this.payMethod(dto.pay);
    const phone = this.collectPhone(dto.phone || influencer.phone, method);
    const collect = await this.payments.initiateCollect({
      purpose: 'boost',
      targetId: purchase.id,
      payerUserId: auth.userId,
      method,
      phone,
      otp: dto.otp,
      amountFcfa: boost.price,
      description: `Option ${boost.label}`,
      customer: { name: influencer.name, email: influencer.user.email },
    });
    await this.db.boostPurchase.update({
      where: { id: purchase.id },
      data: { paymentId: collect.paymentId },
    });
    if (collect.status === 'succeeded') {
      await this.activateBoost(purchase.id);
      return {
        message: boostActivatedMessage(boost.label),
        status: 'active' as const,
        redirectUrl: collect.redirectUrl,
      };
    }
    return {
      message: AWAITING_PAYMENT,
      status: 'awaiting_payment' as const,
      redirectUrl: collect.redirectUrl,
    };
  }

  async activatePlan(subscriptionId: string) {
    const period = periodOf();
    const claimed = await this.db.subscription.updateMany({
      where: { id: subscriptionId, status: 'pending' },
      data: {
        status: 'active',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
    });
    if (claimed.count === 0) {
      return;
    }
    const subscription = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!subscription) {
      return;
    }
    await this.db.subscription.updateMany({
      where: {
        brandId: subscription.brandId,
        id: { not: subscription.id },
        status: { in: ['active', 'past_due'] },
      },
      data: { status: 'cancelled' },
    });
    await this.db.brand.update({
      where: { id: subscription.brandId },
      data: { plan: subscription.plan, planRenewsAt: period.end },
    });
  }

  async activateBoost(purchaseId: string) {
    const period = boostPeriod();
    const claimed = await this.db.boostPurchase.updateMany({
      where: { id: purchaseId, status: 'pending' },
      data: { status: 'active', startsAt: period.start, endsAt: period.end },
    });
    if (claimed.count === 0) {
      return;
    }
    const purchase = await this.db.boostPurchase.findUnique({
      where: { id: purchaseId },
      include: { influencer: { select: { name: true } } },
    });
    if (!purchase) {
      return;
    }
    await this.applyBoost(
      purchase.influencerId,
      purchase.boostKey,
      period.end,
      true,
    );
    if (purchase.boostKey === 'certified') {
      await this.notify.notify(
        'admin',
        `Demande de certification : ${purchase.influencer?.name ?? purchase.influencerId}. À valider dans l'admin.`,
        '/admin',
      );
    }
  }

  async tick(now = new Date()) {
    await this.renewReminders(now);
    await this.markPastDue(now);
    await this.applyGrace(now);
    await this.applyCancelledEnds(now);
    await this.expireBoosts(now);
  }

  async expireBoosts(now = new Date()) {
    const rows = await this.db.boostPurchase.findMany({
      where: { status: 'active', endsAt: { lte: now } },
    });
    for (const row of rows) {
      await this.db.boostPurchase.update({
        where: { id: row.id },
        data: { status: 'expired' },
      });
      await this.applyBoost(row.influencerId, row.boostKey, null, false);
    }
  }

  private async onFinance(event: FinanceEvent) {
    if (event.purpose === 'plan') {
      if (event.type === 'payment.succeeded') {
        await this.activatePlan(event.targetId);
      }
      if (event.type === 'payment.failed') {
        await this.failPlan(event);
      }
      return;
    }
    if (event.purpose === 'boost') {
      if (event.type === 'payment.succeeded') {
        await this.activateBoost(event.targetId);
      }
      if (event.type === 'payment.failed') {
        await this.db.boostPurchase.updateMany({
          where: { id: event.targetId, status: 'pending' },
          data: { status: 'expired' },
        });
      }
    }
  }

  private async failPlan(event: FinanceEvent) {
    const subscription = await this.db.subscription.findUnique({
      where: { id: event.targetId },
    });
    if (!subscription || subscription.status !== 'pending') {
      return;
    }
    const payment = await this.db.payment.findUnique({
      where: { id: event.id },
    });
    if (payment && payment.fromBalanceFcfa > 0) {
      await this.ledger.revenueToBrand(
        subscription.brandId,
        payment.fromBalanceFcfa,
        'Formule remboursée',
      );
    }
    await this.db.subscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled' },
    });
  }

  private async downgradeToFree(brandId: string, current: Plan) {
    const active = await this.db.subscription.findFirst({
      where: { brandId, status: { in: ['active', 'past_due'] } },
      orderBy: { currentPeriodEnd: 'desc' },
    });
    if (!active) {
      await this.db.brand.update({
        where: { id: brandId },
        data: { plan: 'free', planRenewsAt: null },
      });
      return {
        message: 'Formule Découverte activée.',
        status: 'active' as const,
      };
    }
    await this.db.subscription.update({
      where: { id: active.id },
      data: { status: 'cancelled' },
    });
    const when = active.currentPeriodEnd.toLocaleDateString('fr-FR');
    return {
      message: `Votre formule ${planLabel(current as PlanKey)} reste active jusqu'au ${when}.`,
      status: 'cancelled' as const,
    };
  }

  private async renewReminders(now: Date) {
    const from = addDays(now, RENEWAL_NOTICE_DAYS);
    const until = addDays(from, 1);
    const rows = await this.db.subscription.findMany({
      where: { status: 'active', currentPeriodEnd: { gte: from, lt: until } },
    });
    for (const row of rows) {
      await this.notify.notify(
        row.brandId,
        `Votre formule ${planLabel(row.plan)} expire dans 3 jours. Renouvelez pour conserver vos avantages.`,
        '/me?tab=formule',
      );
    }
  }

  private async markPastDue(now: Date) {
    const rows = await this.db.subscription.findMany({
      where: { status: 'active', currentPeriodEnd: { lte: now } },
    });
    for (const row of rows) {
      await this.db.subscription.update({
        where: { id: row.id },
        data: { status: 'past_due' },
      });
      await this.notify.notify(
        row.brandId,
        `Votre formule ${planLabel(row.plan)} est en retard de paiement.`,
        '/me?tab=formule',
      );
    }
  }

  private async applyGrace(now: Date) {
    const limit = addDays(now, -GRACE_DAYS);
    const rows = await this.db.subscription.findMany({
      where: { status: 'past_due', currentPeriodEnd: { lte: limit } },
    });
    for (const row of rows) {
      await this.db.subscription.update({
        where: { id: row.id },
        data: { status: 'cancelled' },
      });
      await this.db.brand.update({
        where: { id: row.brandId },
        data: { plan: 'free', planRenewsAt: null },
      });
    }
  }

  private async applyCancelledEnds(now: Date) {
    const rows = await this.db.subscription.findMany({
      where: { status: 'cancelled', currentPeriodEnd: { lte: now } },
    });
    for (const row of rows) {
      const brand = await this.db.brand.findUnique({
        where: { id: row.brandId },
      });
      if (brand && brand.plan === row.plan) {
        await this.db.brand.update({
          where: { id: row.brandId },
          data: { plan: 'free', planRenewsAt: null },
        });
      }
    }
  }

  private async applyBoost(
    influencerId: string,
    key: BoostKey | BoostKeyRow,
    until: Date | null,
    enable: boolean,
  ) {
    if (key === 'certified') {
      if (enable) {
        return;
      }
      const other = await this.db.boostPurchase.findFirst({
        where: { influencerId, boostKey: 'certified', status: 'active' },
      });
      if (other) {
        return;
      }
      await this.db.influencer.update({
        where: { id: influencerId },
        data: { certified: false },
      });
      await this.bumpInfluencerCache();
      return;
    }
    if (key === 'pro') {
      if (!enable) {
        const other = await this.db.boostPurchase.findFirst({
          where: { influencerId, boostKey: 'pro', status: 'active' },
        });
        if (other) {
          return;
        }
      }
      await this.db.influencer.update({
        where: { id: influencerId },
        data: { featuredUntil: enable ? until : null },
      });
      await this.bumpInfluencerCache();
      return;
    }
    if (!enable) {
      const other = await this.db.boostPurchase.findFirst({
        where: { influencerId, boostKey: 'analytics', status: 'active' },
      });
      if (other) {
        return;
      }
    }
    await this.db.influencer.update({
      where: { id: influencerId },
      data: { analyticsUntil: enable ? until : null },
    });
    await this.bumpInfluencerCache();
  }

  private async bumpInfluencerCache() {
    const current = Number((await this.redis.get('inf:cache:ver')) ?? '0');
    await this.redis.set('inf:cache:ver', String(current + 1));
  }

  private payMethod(value?: string): PayMethod {
    if (value && PAY_METHODS.includes(value as PayKey)) {
      return value as PayMethod;
    }
    return 'om';
  }

  private collectPhone(
    value: string | undefined,
    method: PayMethod,
  ): string | undefined {
    if (method === 'card') {
      return value;
    }
    if (value) {
      assertWithdrawPhone(value);
      return value;
    }
    if (this.env.get('DEMO_MODE') || this.env.get('NODE_ENV') === 'test') {
      return '0700000000';
    }
    assertWithdrawPhone(value);
    return value;
  }
}
