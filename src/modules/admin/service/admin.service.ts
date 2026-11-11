import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { formatFcfa } from '../../../common/format.js';
import { AppError } from '../../../common/http/app.error.js';
import { NOTIFY, type NotifyPort } from '../../../common/notify.js';
import { MAIL, type MailPort } from '../../../infrastructure/mail/mail.port.js';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../../audit/service/audit.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import { CampaignsService } from '../../campaigns/service/campaigns.service.js';
import { withdrawLabel } from '../../billing/domain/withdraw.js';
import { ReconcileService } from '../../finance/service/reconcile.service.js';
import { LedgerService } from '../../finance/service/ledger.service.js';
import { PaymentsService } from '../../finance/service/payments.service.js';
import { toRecord } from '../../influencers/domain/mapper.js';
import { derivedOf } from '../../influencers/domain/metrics.js';
import type { AudienceJson, NetMap } from '../../influencers/domain/types.js';
import { InfluencersService } from '../../influencers/service/influencers.service.js';
import { FlagsService } from '../../platform/service/flags.service.js';
import {
  ledgerCsv,
  presentAdminBrand,
  presentAdminInfluencer,
} from '../domain/present.js';
import type { CreditDto, ScoresDto } from '../dto/admin.dto.js';

const VERIFY_TEXT =
  "Votre profil est vérifié : votre vitrine est visible dans l'annuaire.";

@Injectable()
export class AdminService {
  constructor(
    private readonly db: PrismaService,
    private readonly campaigns: CampaignsService,
    private readonly influencers: InfluencersService,
    private readonly flags: FlagsService,
    private readonly audit: AuditService,
    private readonly ledger: LedgerService,
    private readonly payments: PaymentsService,
    private readonly reconcile: ReconcileService,
    @Inject(NOTIFY) private readonly notify: NotifyPort,
    @Inject(MAIL) private readonly mail: MailPort,
  ) {}

  async dashboard(auth: AuthContext) {
    const [campaigns, influencerRows, brands, flags] = await Promise.all([
      this.campaigns.list(auth),
      this.db.influencer.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.brand.findMany({
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.flags.list(),
    ]);
    const records = await this.influencers.hydrateRows(influencerRows);
    const extras = new Map(influencerRows.map((row) => [row.id, row]));
    return {
      campaigns,
      influencers: records.map((item) =>
        presentAdminInfluencer(item, {
          email: extras.get(item.id)?.user.email ?? '',
          phone: extras.get(item.id)?.phone ?? '',
        }),
      ),
      brands: brands.map(presentAdminBrand),
      flags,
    };
  }

  async verify(id: string, auth: AuthContext, ip?: string | null) {
    const row = await this.requireInfluencer(id);
    const after = await this.db.influencer.update({
      where: { id },
      data: { verified: true, status: 'active' },
      include: { user: { select: { email: true } } },
    });
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'influencer_verify',
      targetType: 'Influencer',
      targetId: id,
      data: {
        before: { verified: row.verified, status: row.status },
        after: { verified: true, status: 'active' },
      },
      ip,
    });
    await this.notify.notify(id, VERIFY_TEXT, `/i/${after.handle}`);
    await this.mail.send(
      after.user.email,
      'Votre profil PULLUP est vérifié',
      `Bonjour ${after.name}, ${VERIFY_TEXT}`,
    );
    await this.influencers.refreshListing();
    return { message: `${after.name} est maintenant vérifié.` };
  }

  async reject(
    id: string,
    auth: AuthContext,
    reason: string | undefined,
    ip?: string | null,
  ) {
    const row = await this.requireInfluencer(id);
    const after = await this.db.influencer.update({
      where: { id },
      data: { status: 'rejected' },
      include: { user: { select: { email: true } } },
    });
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'influencer_reject',
      targetType: 'Influencer',
      targetId: id,
      data: {
        before: { status: row.status },
        after: { status: 'rejected' },
        reason: reason ?? null,
      },
      ip,
    });
    const motif = reason?.trim() ? ` Motif : ${reason.trim()}` : '';
    await this.mail.send(
      after.user.email,
      'Votre inscription PULLUP',
      `Bonjour ${after.name}, votre profil n'a pas été validé.${motif}`,
    );
    await this.influencers.refreshListing();
    return { message: 'Profil refusé.' };
  }

  async suspend(
    id: string,
    auth: AuthContext,
    reason: string,
    ip?: string | null,
  ) {
    const row = await this.requireInfluencer(id);
    await this.db.influencer.update({
      where: { id },
      data: { status: 'suspended' },
    });
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'influencer_suspend',
      targetType: 'Influencer',
      targetId: id,
      data: {
        before: { status: row.status },
        after: { status: 'suspended' },
        reason,
      },
      ip,
    });
    await this.notify.notify(
      id,
      `Votre vitrine a été masquée. Motif : ${reason}`,
      '/me',
    );
    await this.influencers.refreshListing();
    return { message: 'Profil masqué.' };
  }

  async certify(id: string, auth: AuthContext, ip?: string | null) {
    const row = await this.requireInfluencer(id);
    await this.db.influencer.update({
      where: { id },
      data: { certified: true },
    });
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'influencer_certify',
      targetType: 'Influencer',
      targetId: id,
      data: {
        before: { certified: row.certified },
        after: { certified: true },
      },
      ip,
    });
    await this.notify.notify(
      id,
      'Votre badge Certifié est activé.',
      `/i/${row.handle}`,
    );
    await this.influencers.refreshListing();
    return { message: `${row.name} est maintenant certifié.` };
  }

  async updateScores(
    id: string,
    auth: AuthContext,
    dto: ScoresDto,
    ip?: string | null,
  ) {
    const row = await this.requireInfluencer(id);
    const data: Prisma.InfluencerUpdateInput = {};
    if (dto.auth !== undefined) data.scoreAuth = dto.auth;
    if (dto.creat !== undefined) data.scoreCreat = dto.creat;
    if (dto.brief !== undefined) data.scoreBrief = dto.brief;
    if (dto.onTime !== undefined) data.scoreOnTime = dto.onTime;
    if (dto.aud) data.audience = dto.aud as unknown as Prisma.InputJsonValue;
    if (dto.net) data.nets = dto.net as unknown as Prisma.InputJsonValue;
    const next = {
      ...toRecord(row, []),
      auth: dto.auth ?? row.scoreAuth,
      creat: dto.creat ?? row.scoreCreat,
      brief: dto.brief ?? row.scoreBrief,
      onTime: dto.onTime ?? row.scoreOnTime,
      aud:
        (dto.aud as AudienceJson | undefined) ??
        (row.audience as unknown as AudienceJson),
      net: (dto.net as NetMap | undefined) ?? (row.nets as NetMap),
    };
    Object.assign(data, derivedOf(next));
    await this.db.influencer.update({ where: { id }, data });
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'influencer_scores',
      targetType: 'Influencer',
      targetId: id,
      data: {
        before: {
          auth: row.scoreAuth,
          creat: row.scoreCreat,
          brief: row.scoreBrief,
          onTime: row.scoreOnTime,
        },
        after: {
          auth: next.auth,
          creat: next.creat,
          brief: next.brief,
          onTime: next.onTime,
        },
      },
      ip,
    });
    await this.influencers.refreshListing();
    return { message: 'Statistiques mises à jour.' };
  }

  async financeSummary() {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const [holds, commissions, pending, gaps] = await Promise.all([
      this.db.escrowHold.aggregate({
        where: { state: 'open' },
        _sum: { amountFcfa: true },
      }),
      this.db.ledgerEntry.aggregate({
        where: {
          accountType: 'platform_revenue',
          direction: 'credit',
          createdAt: { gte: monthStart },
        },
        _sum: { amountFcfa: true },
      }),
      this.db.withdrawal.aggregate({
        where: { status: 'pending' },
        _sum: { amountFcfa: true },
      }),
      this.reconcile.inspect(),
    ]);
    return {
      escrow: holds._sum.amountFcfa ?? 0,
      commissionsMonth: commissions._sum.amountFcfa ?? 0,
      pendingWithdrawals: pending._sum.amountFcfa ?? 0,
      gaps,
    };
  }

  async ledgerCsv(from?: string, to?: string) {
    const rows = await this.db.ledgerEntry.findMany({
      where: {
        createdAt: {
          ...(parseDay(from, false) ? { gte: parseDay(from, false) } : {}),
          ...(parseDay(to, true) ? { lte: parseDay(to, true) } : {}),
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return ledgerCsv(rows);
  }

  async withdrawals(status?: 'pending' | 'sent' | 'failed') {
    const rows = await this.db.withdrawal.findMany({
      where: status ? { status } : {},
      include: {
        influencer: { select: { id: true, name: true, handle: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      influencerId: row.influencerId,
      influencer: row.influencer,
      amount: row.amountFcfa,
      operator: row.operator,
      phone: row.phone,
      status: row.status,
      payoutId: row.payoutId,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async retryWithdrawal(id: string, auth: AuthContext, ip?: string | null) {
    const withdrawal = await this.db.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) {
      throw new AppError('Introuvable.', 404);
    }
    if (withdrawal.status !== 'failed') {
      throw new AppError(
        'Seuls les retraits échoués peuvent être relancés.',
        422,
      );
    }
    const label = withdrawLabel(withdrawal.operator);
    const created = await this.db.$transaction(async (tx) => {
      await this.ledger.walletToPayout(
        withdrawal.influencerId,
        withdrawal.amountFcfa,
        label,
        tx,
      );
      const payout = await tx.payout.create({
        data: {
          purpose: 'withdrawal',
          targetId: withdrawal.influencerId,
          amountFcfa: withdrawal.amountFcfa,
          operator: withdrawal.operator,
          phone: withdrawal.phone,
          status: 'pending',
          rawPayload: {},
        },
      });
      const updated = await tx.withdrawal.update({
        where: { id },
        data: { status: 'pending', payoutId: payout.id },
      });
      return { payout, withdrawal: updated };
    });
    await this.payments.dispatchPayout(created.payout);
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'withdrawal_retry',
      targetType: 'Withdrawal',
      targetId: id,
      data: {
        before: { status: 'failed' },
        after: { status: 'pending' },
        payoutId: created.payout.id,
      },
      ip,
    });
    return { message: 'Retrait relancé.' };
  }

  async auditLog(filters: { actor?: string; target?: string }) {
    const rows = await this.audit.list(filters);
    return rows.map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      data: row.data,
      ip: row.ip,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async creditBrand(
    id: string,
    auth: AuthContext,
    dto: CreditDto,
    ip?: string | null,
  ) {
    const brand = await this.db.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new AppError('Profil introuvable.', 404);
    }
    const reason = dto.reason.trim();
    if (!reason) {
      throw new AppError('Indiquez le motif du geste commercial.', 422);
    }
    const label = `Geste commercial : ${reason}`;
    await this.ledger.creditBrand(id, dto.amount, label);
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'brand_credit',
      targetType: 'Brand',
      targetId: id,
      data: {
        before: { balance: brand.balanceFcfa },
        after: { balance: brand.balanceFcfa + dto.amount },
        reason,
        amount: dto.amount,
      },
      ip,
    });
    return { message: `${formatFcfa(dto.amount)} crédités.` };
  }

  private async requireInfluencer(id: string) {
    const row = await this.db.influencer.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    });
    if (!row) {
      throw new AppError('Profil introuvable.', 404);
    }
    return row;
  }
}

function parseDay(value: string | undefined, end: boolean): Date | undefined {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Période invalide.', 400);
  }
  if (end && value.length <= 10) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}
