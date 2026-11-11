import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class SessionsRepository {
  constructor(private readonly db: PrismaService) {}

  create(input: {
    id: string;
    userId: string;
    expiresAt: Date;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    return this.db.session.create({ data: input });
  }

  deleteById(id: string) {
    return this.db.session.deleteMany({ where: { id } });
  }

  deleteByUser(userId: string) {
    return this.db.session.deleteMany({ where: { userId } });
  }
}
