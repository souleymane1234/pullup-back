import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

type Db = Prisma.TransactionClient | PrismaService;

@Injectable()
export class NotificationsRepository {
  constructor(private readonly db: PrismaService) {}

  create(input: { recipientKey: string; text: string; link: string }, tx?: Db) {
    return (tx ?? this.db).notification.create({ data: input });
  }

  listFor(recipientKey: string, limit = 50) {
    return this.db.notification.findMany({
      where: { recipientKey },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  markAllRead(recipientKey: string) {
    return this.db.notification.updateMany({
      where: { recipientKey, readAt: null },
      data: { readAt: new Date() },
    });
  }

  purgeReadOlderThan(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.db.notification.deleteMany({
      where: { readAt: { not: null, lt: cutoff } },
    });
  }
}
