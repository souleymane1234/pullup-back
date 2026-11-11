import { Injectable } from '@nestjs/common';
import type { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly db: PrismaService) {}

  findByEmail(email: string) {
    return this.db.user.findFirst({
      where: { email, deletedAt: null },
      include: { brand: true, influencer: true },
    });
  }

  findById(id: string) {
    return this.db.user.findFirst({
      where: { id, deletedAt: null },
      include: { brand: true, influencer: true },
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.db.user.create({
      data,
      include: { brand: true, influencer: true },
    });
  }

  touchLogin(id: string) {
    return this.db.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.db.user.update({ where: { id }, data: { passwordHash } });
  }

  anonymize(id: string, email: string, passwordHash: string) {
    return this.db.user.update({
      where: { id },
      data: { email, passwordHash, deletedAt: new Date() },
    });
  }

  createAdmin(input: { email: string; passwordHash: string; id?: string }) {
    return this.db.user.create({
      data: {
        id: input.id,
        email: input.email,
        passwordHash: input.passwordHash,
        role: 'admin' as Role,
      },
    });
  }
}
