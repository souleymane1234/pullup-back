import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class ReferencesRepository {
  constructor(private readonly db: PrismaService) {}

  async nextValue(name: string): Promise<number> {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO ref_sequences (\`name\`, \`value\`)
        VALUES (${name}, 1)
        ON DUPLICATE KEY UPDATE \`value\` = \`value\` + 1
      `;
      const row = await tx.refSequence.findUniqueOrThrow({ where: { name } });
      return row.value;
    });
  }
}
