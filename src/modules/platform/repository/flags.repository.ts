import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';
import { defaultFlags, type FlagKey } from '../domain/flags.js';

@Injectable()
export class FlagsRepository {
  constructor(private readonly db: PrismaService) {}

  async list(): Promise<Record<FlagKey, boolean>> {
    const rows = await this.db.featureFlag.findMany();
    const flags = defaultFlags();
    for (const row of rows) {
      if (row.key === 'v2' || row.key === 'v3') {
        flags[row.key] = row.value;
      }
    }
    return flags;
  }

  upsert(key: FlagKey, value: boolean, updatedBy: string | null) {
    return this.db.featureFlag.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }
}
