import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class AuditRepository {
  constructor(private readonly db: PrismaService) {}

  create(input: {
    actorUserId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    data: Prisma.InputJsonValue;
    ip?: string | null;
  }) {
    return this.db.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        data: input.data,
        ip: input.ip ?? null,
      },
    });
  }

  list(filters: { actor?: string; target?: string }) {
    return this.db.auditLog.findMany({
      where: {
        ...(filters.actor ? { actorUserId: filters.actor } : {}),
        ...(filters.target ? { targetId: filters.target } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
