import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class BrandsRepository {
  constructor(private readonly db: PrismaService) {}

  findById(id: string) {
    return this.db.brand.findUnique({ where: { id }, include: { user: true } });
  }

  create(data: Prisma.BrandCreateInput) {
    return this.db.brand.create({ data, include: { user: true } });
  }

  anonymize(id: string) {
    return this.db.brand.update({
      where: { id },
      data: { name: 'Compte supprimé', contactName: '', sector: '' },
    });
  }
}
