import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { FeatureGuard } from '../src/common/guards/feature.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { AppError } from '../src/common/http/app.error.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { FEATURE_DISABLED } from '../src/modules/platform/domain/flags.js';
import { FlagsService } from '../src/modules/platform/service/flags.service.js';
import { CampaignsController } from '../src/modules/campaigns/controller/campaigns.controller.js';
import { CampaignLifecycleService } from '../src/modules/campaigns/service/campaign-lifecycle.service.js';
import { CampaignsService } from '../src/modules/campaigns/service/campaigns.service.js';
import { UploadService } from '../src/modules/campaigns/service/upload.service.js';

const payload = {
  infId: 'i1',
  rateId: 'r2',
  pay: 'om',
  phone: '0700000000',
  brief: {
    title: 'Lancement',
    objective: 'notoriete',
    theme: 'beaute',
    text: 'Présenter le sérum dans une routine du matin.',
  },
};

describe('campagnes (e2e)', () => {
  it('répond 403 si v2 est désactivée', async () => {
    const app = await campaignsApp(
      {
        assertEnabled: vi
          .fn()
          .mockRejectedValue(new AppError(FEATURE_DISABLED, 403)),
      },
      { create: vi.fn() },
      { userId: 'u1', role: 'brand', profileId: 'b1' },
    );
    const response = await request(app.getHttpServer())
      .post('/api/campaigns')
      .send(payload)
      .expect(403);
    expect(response.body).toEqual({ message: FEATURE_DISABLED });
    await app.close();
  });

  it('refuse un influenceur sur POST /campaigns', async () => {
    const app = await campaignsApp(
      { assertEnabled: vi.fn().mockResolvedValue(undefined) },
      { create: vi.fn() },
      { userId: 'u2', role: 'influencer', profileId: 'i1' },
    );
    const response = await request(app.getHttpServer())
      .post('/api/campaigns')
      .send(payload)
      .expect(403);
    expect(response.body).toEqual({
      message: 'Action non autorisée pour ce compte.',
    });
    await app.close();
  });

  it('renvoie null pour un profil non listé', async () => {
    const booking = vi.fn().mockResolvedValue(null);
    const app = await campaignsApp({ assertEnabled: vi.fn() }, { booking }, {});
    const response = await request(app.getHttpServer())
      .get('/api/booking/inconnu')
      .expect(200);
    expect(response.body).toBeNull();
    expect(booking).toHaveBeenCalledWith('inconnu', undefined);
    await app.close();
  });

  it('renvoie forbidden ou missing en HTTP 200', async () => {
    const getOne = vi
      .fn()
      .mockResolvedValueOnce({ access: 'forbidden' })
      .mockResolvedValueOnce({ access: 'missing' });
    const app = await campaignsApp(
      { assertEnabled: vi.fn() },
      { getOne },
      { userId: 'u1', role: 'brand', profileId: 'b1' },
    );
    const forbidden = await request(app.getHttpServer())
      .get('/api/campaigns/c1')
      .expect(200);
    expect(forbidden.body).toEqual({ access: 'forbidden' });
    const missing = await request(app.getHttpServer())
      .get('/api/campaigns/inconnu')
      .expect(200);
    expect(missing.body).toEqual({ access: 'missing' });
    await app.close();
  });

  it('renvoie 200 sur une action du cycle de vie', async () => {
    const act = vi.fn().mockResolvedValue({
      message: 'Campagne acceptée. Publiez à la date prévue.',
    });
    const app = await campaignsApp(
      { assertEnabled: vi.fn() },
      {},
      { userId: 'u2', role: 'influencer', profileId: 'i1' },
      { act },
    );
    const response = await request(app.getHttpServer())
      .post('/api/campaigns/c1/accept')
      .send({})
      .expect(200);
    expect(response.body).toEqual({
      message: 'Campagne acceptée. Publiez à la date prévue.',
    });
    expect(act).toHaveBeenCalledWith(
      'c1',
      'accept',
      expect.objectContaining({ role: 'influencer' }),
      {},
    );
    await app.close();
  });

  it('refuse un non-admin sur la validation automatique', async () => {
    const app = await campaignsApp(
      { assertEnabled: vi.fn() },
      {},
      { userId: 'u1', role: 'brand', profileId: 'b1' },
    );
    const response = await request(app.getHttpServer())
      .post('/api/admin/campaigns/auto-validate')
      .expect(403);
    expect(response.body).toEqual({
      message: 'Action non autorisée pour ce compte.',
    });
    await app.close();
  });
});

async function campaignsApp(
  flags: { assertEnabled: unknown },
  campaigns: Record<string, unknown>,
  session: Record<string, string>,
  lifecycle: Record<string, unknown> = {},
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [CampaignsController],
    providers: [
      { provide: CampaignsService, useValue: campaigns },
      {
        provide: CampaignLifecycleService,
        useValue: {
          act: vi.fn(),
          review: vi.fn(),
          message: vi.fn(),
          autoValidatePublished: vi.fn(),
          ...lifecycle,
        },
      },
      { provide: UploadService, useValue: { presignBrief: vi.fn() } },
      { provide: FlagsService, useValue: flags },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
      { provide: APP_GUARD, useClass: FeatureGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.session = session as never;
    next();
  });
  await app.init();
  return app;
}
