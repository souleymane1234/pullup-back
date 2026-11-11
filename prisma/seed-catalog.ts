import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  defaultCatalogRecords,
  metaOf,
} from '../src/modules/catalog/domain/catalog.js';

export async function seedCatalog(prisma: PrismaClient) {
  for (const item of defaultCatalogRecords()) {
    await prisma.catalogItem.upsert({
      where: { kind_key: { kind: item.kind, key: item.key } },
      update: {
        label: item.label,
        meta: metaOf(item) as Prisma.InputJsonValue,
        sortOrder: item.sortOrder,
      },
      create: {
        kind: item.kind,
        key: item.key,
        label: item.label,
        meta: metaOf(item) as Prisma.InputJsonValue,
        sortOrder: item.sortOrder,
        active: item.active,
      },
    });
  }
}
