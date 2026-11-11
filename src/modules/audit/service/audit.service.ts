import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditRepository } from '../repository/audit.repository.js';

@Injectable()
export class AuditService {
  constructor(private readonly logs: AuditRepository) {}

  record(input: {
    actorUserId?: string | null;
    action: string;
    targetType: string;
    targetId: string;
    data?: Prisma.InputJsonValue;
    ip?: string | null;
  }) {
    return this.logs.create({
      ...input,
      data: input.data ?? {},
    });
  }

  list(filters: { actor?: string; target?: string }) {
    return this.logs.list(filters);
  }
}
