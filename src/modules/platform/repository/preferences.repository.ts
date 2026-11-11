import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class PreferencesRepository {
  constructor(private readonly db: PrismaService) {}

  find(userId: string) {
    return this.db.userPreference.findUnique({ where: { userId } });
  }

  upsertOnboarded(userId: string, onboarded: boolean) {
    return this.db.userPreference.upsert({
      where: { userId },
      create: { userId, onboarded },
      update: { onboarded },
    });
  }
}
