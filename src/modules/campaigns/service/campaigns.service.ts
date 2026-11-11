import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Campaign } from '@prisma/client';
import { PAY, type PlanKey } from '../../../common/catalog.js';
import { formatFcfa } from '../../../common/format.js';
import { AppError, forbidden } from '../../../common/http/app.error.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import type { FinanceEvent } from '../../finance/domain/events.js';
import { FinanceEvents } from '../../finance/domain/events.js';
import { LedgerService } from '../../finance/service/ledger.service.js';
import { PaymentsService } from '../../finance/service/payments.service.js';
import { isListed } from '../../influencers/domain/metrics.js';
import type { RateJson } from '../../influencers/domain/types.js';
import { InfluencersService } from '../../influencers/service/influencers.service.js';
import { ReferencesService } from '../../references/service/references.service.js';
import { assertBrief, assertPhone } from '../domain/brief.js';
import { assertQuota, paymentSplit, splitOffer } from '../domain/booking.js';
import { campaignMoney } from '../domain/money.js';
import { presentPaymentStatus } from '../domain/payment-status.js';
import { presentCampaign } from '../domain/present.js';
import { isParty } from '../domain/transitions.js';
import { buildUtm } from '../domain/utm.js';
import type { CreateCampaignDto } from '../dto/campaigns.dto.js';
import { campaignLoad } from './campaign-lifecycle.service.js';

@Injectable()
export class CampaignsService implements OnModuleInit, OnModuleDestroy {
  private readonly offs: Array<() => void> = [];

  constructor(
    private readonly db: PrismaService,
    private readonly influencers: InfluencersService,
    private readonly refs: ReferencesService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly events: FinanceEvents,
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

  async booking(handle: string, auth?: AuthContext) {
    const influencer = await this.influencers.presentedByHandle(handle, auth);
    if (!influencer) {
      return null;
    }
    let balance = 0;
    if (auth?.role === 'brand') {
      const brand = await this.db.brand.findUnique({
        where: { id: auth.profileId },
      });
      balance = brand?.balanceFcfa ?? 0;
    }
    return { influencer, balance };
  }

  async paymentStatus(id: string, auth: AuthContext) {
    const campaign = await this.db.campaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new AppError('Introuvable.', 404);
    }
    const party =
      auth.role === 'admin' ||
      auth.profileId === campaign.brandId ||
      auth.profileId === campaign.influencerId;
    if (!party) {
      throw forbidden();
    }
    return { status: presentPaymentStatus(campaign.status) };
  }

  async list(auth: AuthContext) {
    const where =
      auth.role === 'admin'
        ? {}
        : auth.role === 'brand'
          ? { brandId: auth.profileId }
          : { influencerId: auth.profileId };
    const rows = await this.db.campaign.findMany({
      where,
      include: campaignLoad,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => presentCampaign(row));
  }

  async getOne(id: string, auth: AuthContext) {
    const row = await this.db.campaign.findUnique({
      where: { id },
      include: campaignLoad,
    });
    if (!row) {
      return { access: 'missing' as const };
    }
    if (!isParty(auth, row)) {
      return { access: 'forbidden' as const };
    }
    return { access: 'ok' as const, campaign: presentCampaign(row) };
  }

  async create(auth: AuthContext, dto: CreateCampaignDto) {
    const brand = await this.db.brand.findUnique({
      where: { id: auth.profileId },
      include: { user: true },
    });
    if (!brand) {
      throw new AppError('Profil introuvable.', 404);
    }
    const influencer = await this.db.influencer.findUnique({
      where: { id: dto.infId },
    });
    if (!influencer || !isListed(influencer)) {
      throw new AppError('Profil introuvable.', 404);
    }
    const rate = ((influencer.rates as unknown as RateJson[]) ?? []).find(
      (item) => item.id === dto.rateId && !item.archivedAt,
    );
    if (!rate) {
      throw new AppError('Choisissez une offre.', 422);
    }
    const used = await this.db.campaign.count({
      where: {
        brandId: brand.id,
        createdAt: { gte: startOfUtcMonth() },
        NOT: {
          AND: [{ status: 'cancelled' }, { cancelReason: 'payment_failed' }],
        },
      },
    });
    assertQuota(brand.plan as PlanKey, used);
    const brief = assertBrief(dto.brief);
    assertPhone(dto.pay, dto.phone);
    if (brief.file) {
      const upload = await this.db.upload.findFirst({
        where: {
          fileUrl: brief.file,
          ownerUserId: auth.userId,
          purpose: 'brief',
        },
      });
      if (!upload) {
        throw new AppError('Fichier de brief introuvable.', 422);
      }
    }
    const { amount, fee, payout } = splitOffer(rate.price);
    const { fromBalance, toCollect } = paymentSplit(brand.balanceFcfa, amount);
    const ref = await this.refs.nextCampaignRef();
    const campaign = await this.db.campaign.create({
      data: {
        ref,
        brandId: brand.id,
        influencerId: influencer.id,
        offerRateId: rate.id,
        offerNet: rate.net,
        offerFormat: rate.fmt,
        offerPrice: rate.price,
        amountFcfa: amount,
        feeFcfa: fee,
        payoutFcfa: payout,
        fromBalanceFcfa: fromBalance,
        payMethod: dto.pay,
        status: 'awaiting_payment',
        briefTitle: brief.title,
        briefObjective: brief.objective,
        briefTheme: brief.theme,
        briefText: brief.text,
        briefLink: brief.link,
        briefDate: brief.date,
        briefFileUrl: brief.file,
        utmUrl: buildUtm(
          { ref, offerNet: rate.net, briefLink: brief.link },
          influencer.handle,
        ),
      },
    });
    const money = campaignMoney(campaign);
    let reserved = 0;
    try {
      if (fromBalance > 0) {
        await this.ledger.balanceToEscrow(brand.id, money, fromBalance);
        reserved = fromBalance;
      }
      if (toCollect === 0) {
        await this.markPaid(campaign, brand.name);
        return {
          id: campaign.id,
          status: 'paid' as const,
          message: 'Paiement reçu. Les fonds sont sous séquestre.',
        };
      }
      const collect = await this.payments.initiateCollect({
        purpose: 'campaign',
        targetId: campaign.id,
        payerUserId: auth.userId,
        method: dto.pay,
        phone: dto.phone,
        otp: dto.otp,
        amountFcfa: toCollect,
        fromBalanceFcfa: fromBalance,
        description: `Campagne ${ref}`,
        customer: { name: brand.name, email: brand.user.email },
      });
      const fresh = await this.db.campaign.findUnique({
        where: { id: campaign.id },
      });
      if (collect.status === 'succeeded' || fresh?.status === 'paid') {
        if (fresh?.status !== 'paid') {
          await this.onPaymentSucceeded({
            type: 'payment.succeeded',
            id: collect.paymentId,
            targetId: campaign.id,
            amount: toCollect,
            purpose: 'campaign',
          });
        }
        return {
          id: campaign.id,
          status: 'paid' as const,
          message: 'Paiement reçu. Les fonds sont sous séquestre.',
        };
      }
      return {
        id: campaign.id,
        status: 'awaiting_payment' as const,
        message: 'Confirmez le paiement sur votre téléphone.',
        redirectUrl: collect.redirectUrl,
      };
    } catch (error) {
      await this.failPayment(campaign, reserved);
      throw error;
    }
  }

  async onPaymentSucceeded(event: FinanceEvent) {
    const claimed = await this.db.campaign.updateMany({
      where: { id: event.targetId, status: 'awaiting_payment' },
      data: { status: 'paid' },
    });
    if (claimed.count === 0) {
      return;
    }
    const campaign = await this.db.campaign.findUnique({
      where: { id: event.targetId },
      include: { brand: true },
    });
    if (!campaign) {
      return;
    }
    if (event.amount > 0) {
      await this.ledger.collectToEscrow(campaignMoney(campaign), event.amount);
    }
    await this.announcePaid(campaign, campaign.brand.name);
  }

  async onPaymentFailed(event: FinanceEvent) {
    const campaign = await this.db.campaign.findUnique({
      where: { id: event.targetId },
    });
    if (!campaign || campaign.status !== 'awaiting_payment') {
      return;
    }
    await this.failPayment(campaign, campaign.fromBalanceFcfa, true);
  }

  private async onFinance(event: FinanceEvent) {
    if (event.purpose && event.purpose !== 'campaign') {
      return;
    }
    if (event.type === 'payment.succeeded') {
      await this.onPaymentSucceeded(event);
      return;
    }
    if (event.type === 'payment.failed') {
      await this.onPaymentFailed(event);
    }
  }

  private async markPaid(campaign: Campaign, brandName: string) {
    const claimed = await this.db.campaign.updateMany({
      where: { id: campaign.id, status: 'awaiting_payment' },
      data: { status: 'paid' },
    });
    if (claimed.count === 0) {
      return;
    }
    await this.announcePaid(campaign, brandName);
  }

  private async announcePaid(campaign: Campaign, brandName: string) {
    const operator =
      PAY[campaign.payMethod as keyof typeof PAY] ?? campaign.payMethod;
    await this.addEvent(
      campaign.id,
      'paid',
      `Paiement ${operator} reçu · ${formatFcfa(campaign.amountFcfa)} bloqués en séquestre`,
    );
    await this.notify.notify(
      campaign.influencerId,
      `Nouvelle campagne de ${brandName} : ${formatFcfa(campaign.amountFcfa)} bloqués en séquestre. Acceptez-la sous 72 h.`,
      `/c/${campaign.id}`,
    );
  }

  private async failPayment(
    campaign: Campaign,
    fromBalance: number,
    notifyBrand = false,
  ) {
    const claimed = await this.db.campaign.updateMany({
      where: { id: campaign.id, status: 'awaiting_payment' },
      data: { status: 'cancelled', cancelReason: 'payment_failed' },
    });
    if (claimed.count === 0) {
      return;
    }
    if (fromBalance > 0) {
      await this.ledger.escrowToBrand(campaignMoney(campaign), fromBalance);
    }
    await this.addEvent(campaign.id, 'cancelled', 'Paiement non abouti');
    if (notifyBrand) {
      await this.notify.notify(
        campaign.brandId,
        "Le paiement de votre campagne n'a pas abouti.",
        `/c/${campaign.id}`,
      );
    }
  }

  private addEvent(campaignId: string, status: string, note: string) {
    return this.db.campaignEvent.create({ data: { campaignId, status, note } });
  }
}

function startOfUtcMonth(at = new Date()): Date {
  return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
}
