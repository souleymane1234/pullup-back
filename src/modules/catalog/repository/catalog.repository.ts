import { Injectable } from '@nestjs/common';
import type { CatalogKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class CatalogRepository {
  constructor(private readonly db: PrismaService) {}

  count() {
    return this.db.catalogItem.count();
  }

  list() {
    return this.db.catalogItem.findMany({
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { key: 'asc' }],
    });
  }

  listKind(kind: CatalogKind) {
    return this.db.catalogItem.findMany({
      where: { kind },
      orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
    });
  }

  find(kind: CatalogKind, key: string) {
    return this.db.catalogItem.findUnique({
      where: { kind_key: { kind, key } },
    });
  }

  create(data: Prisma.CatalogItemCreateInput) {
    return this.db.catalogItem.create({ data });
  }

  createMany(data: Prisma.CatalogItemCreateManyInput[]) {
    return this.db.catalogItem.createMany({ data, skipDuplicates: true });
  }

  update(kind: CatalogKind, key: string, data: Prisma.CatalogItemUpdateInput) {
    return this.db.catalogItem.update({
      where: { kind_key: { kind, key } },
      data,
    });
  }
}
