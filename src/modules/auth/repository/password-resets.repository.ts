import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class PasswordResetsRepository {
  constructor(private readonly db: PrismaService) {}

  create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    return this.db.passwordReset.create({ data: input });
  }

  findValid(tokenHash: string) {
    return this.db.passwordReset.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  markUsed(id: string) {
    return this.db.passwordReset.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}
