import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

@Injectable()
export class InfluencersRepository {
  constructor(private readonly db: PrismaService) {}

  findById(id: string) {
    return this.db.influencer.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  findByHandle(handle: string) {
    return this.db.influencer.findUnique({ where: { handle } });
  }

  create(data: Prisma.InfluencerCreateInput) {
    return this.db.influencer.create({ data, include: { user: true } });
  }

  anonymize(id: string, handle: string) {
    return this.db.influencer.update({
      where: { id },
      data: {
        name: 'Compte supprimé',
        handle,
        phone: '',
        photoUrl: null,
        bio: 'Compte supprimé.',
        bioDraft: null,
      },
    });
  }
}
