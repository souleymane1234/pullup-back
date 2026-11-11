import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  catalogLiveFromRecords,
  setCatalogLive,
  type CatalogKind,
} from '../../../common/catalog-live.js';
import { AppError } from '../../../common/http/app.error.js';
import { AuditService } from '../../audit/service/audit.service.js';
import type { AuthContext } from '../../auth/domain/session.js';
import {
  assertCatalogKind,
  catalogCreatedMessage,
  catalogHiddenMessage,
  catalogUpdatedMessage,
  defaultCatalogRecords,
  groupCatalogAdmin,
  metaOf,
  presentCatalogItem,
  presentCatalogPublic,
  recordFromRow,
  resolveCatalogKey,
  type CatalogRecord,
} from '../domain/catalog.js';
import type { CreateCatalogDto, UpdateCatalogDto } from '../dto/catalog.dto.js';
import { CatalogRepository } from '../repository/catalog.repository.js';

@Injectable()
export class CatalogService implements OnModuleInit {
  constructor(
    private readonly items: CatalogRepository,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaults();
    await this.refreshLive();
  }

  async publicSnapshot() {
    const records = await this.loadRecords();
    return presentCatalogPublic(catalogLiveFromRecords(records));
  }

  async adminList() {
    return groupCatalogAdmin(await this.loadRecords());
  }

  async create(dto: CreateCatalogDto, auth: AuthContext, ip?: string | null) {
    const kind = dto.kind;
    const label = dto.label.trim();
    const key = resolveCatalogKey(kind, dto.key, label);
    const related = this.normalizeRelated(kind, dto.related);
    const reco = kind === 'objective' ? dto.reco?.trim() || null : null;
    await this.assertRelatedExist(kind, related, key);
    const existing = await this.items.find(kind, key);
    if (existing) {
      throw new AppError('Cette clé existe déjà.', 409);
    }
    const sortOrder = dto.sortOrder ?? (await this.nextSortOrder(kind));
    const record: CatalogRecord = {
      kind,
      key,
      label,
      related,
      reco,
      sortOrder,
      active: dto.active ?? true,
    };
    const row = await this.items.create({
      kind,
      key,
      label,
      meta: metaOf(record) as Prisma.InputJsonValue,
      sortOrder,
      active: record.active,
    });
    await this.refreshLive();
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'catalog_create',
      targetType: 'CatalogItem',
      targetId: `${kind}:${key}`,
      data: { after: presentCatalogItem(recordFromRow(row)) },
      ip,
    });
    return {
      message: catalogCreatedMessage(kind),
      item: presentCatalogItem(recordFromRow(row)),
    };
  }

  async update(
    kindParam: string,
    key: string,
    dto: UpdateCatalogDto,
    auth: AuthContext,
    ip?: string | null,
  ) {
    const kind = assertCatalogKind(kindParam);
    const row = await this.items.find(kind, key);
    if (!row) {
      throw new AppError('Élément introuvable.', 404);
    }
    const current = recordFromRow(row);
    const next: CatalogRecord = {
      ...current,
      label: dto.label?.trim() || current.label,
      related:
        dto.related !== undefined
          ? this.normalizeRelated(kind, dto.related)
          : current.related,
      reco:
        kind === 'objective'
          ? dto.reco === undefined
            ? current.reco
            : dto.reco?.trim() || null
          : null,
      sortOrder: dto.sortOrder ?? current.sortOrder,
      active: dto.active ?? current.active,
    };
    if (next.active === false) {
      await this.assertNotLastActive(kind, key);
    }
    await this.assertRelatedExist(kind, next.related, key);
    const updated = await this.items.update(kind, key, {
      label: next.label,
      meta: metaOf(next) as Prisma.InputJsonValue,
      sortOrder: next.sortOrder,
      active: next.active,
    });
    await this.refreshLive();
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'catalog_update',
      targetType: 'CatalogItem',
      targetId: `${kind}:${key}`,
      data: {
        before: presentCatalogItem(current),
        after: presentCatalogItem(recordFromRow(updated)),
      },
      ip,
    });
    return {
      message: catalogUpdatedMessage(kind),
      item: presentCatalogItem(recordFromRow(updated)),
    };
  }

  async hide(
    kindParam: string,
    key: string,
    auth: AuthContext,
    ip?: string | null,
  ) {
    const kind = assertCatalogKind(kindParam);
    const row = await this.items.find(kind, key);
    if (!row) {
      throw new AppError('Élément introuvable.', 404);
    }
    if (!row.active) {
      return {
        message: catalogHiddenMessage(kind),
        item: presentCatalogItem(recordFromRow(row)),
      };
    }
    await this.assertNotLastActive(kind, key);
    const updated = await this.items.update(kind, key, { active: false });
    await this.refreshLive();
    await this.audit.record({
      actorUserId: auth.userId,
      action: 'catalog_hide',
      targetType: 'CatalogItem',
      targetId: `${kind}:${key}`,
      data: { key, kind },
      ip,
    });
    return {
      message: catalogHiddenMessage(kind),
      item: presentCatalogItem(recordFromRow(updated)),
    };
  }

  private async ensureDefaults() {
    if ((await this.items.count()) > 0) {
      return;
    }
    await this.items.createMany(
      defaultCatalogRecords().map((item) => ({
        kind: item.kind,
        key: item.key,
        label: item.label,
        meta: metaOf(item) as Prisma.InputJsonValue,
        sortOrder: item.sortOrder,
        active: item.active,
      })),
    );
  }

  private async refreshLive() {
    setCatalogLive(catalogLiveFromRecords(await this.loadRecords()));
  }

  private async loadRecords() {
    const rows = await this.items.list();
    return rows.map(recordFromRow);
  }

  private normalizeRelated(kind: CatalogKind, related?: string[]) {
    if (kind !== 'category') {
      return [];
    }
    return [
      ...new Set((related ?? []).map((value) => value.trim()).filter(Boolean)),
    ];
  }

  private async assertRelatedExist(
    kind: CatalogKind,
    related: string[],
    selfKey: string,
  ) {
    if (kind !== 'category' || related.length === 0) {
      return;
    }
    const categories = await this.items.listKind('category');
    const keys = new Set(categories.map((item) => item.key));
    keys.add(selfKey);
    for (const key of related) {
      if (!keys.has(key)) {
        throw new AppError('Thématique liée inconnue.', 422);
      }
    }
  }

  private async assertNotLastActive(kind: CatalogKind, key: string) {
    const rows = await this.items.listKind(kind);
    const others = rows.filter((item) => item.active && item.key !== key);
    if (others.length === 0) {
      throw new AppError('Gardez au moins un élément actif.', 409);
    }
  }

  private async nextSortOrder(kind: CatalogKind) {
    const rows = await this.items.listKind(kind);
    return rows.reduce((max, item) => Math.max(max, item.sortOrder), -1) + 1;
  }
}
