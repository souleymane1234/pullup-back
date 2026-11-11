import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { SessionGuard } from '../src/common/guards/session.guard.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { AdminFlagsController } from '../src/modules/platform/controller/admin-flags.controller.js';
import { NotificationsController } from '../src/modules/platform/controller/notifications.controller.js';
import { PlatformController } from '../src/modules/platform/controller/platform.controller.js';
import { PreferencesController } from '../src/modules/platform/controller/preferences.controller.js';
import { FlagsService } from '../src/modules/platform/service/flags.service.js';
import { PlatformService } from '../src/modules/platform/service/platform.service.js';

const brandNotif = {
  to: 'b1',
  t: 'Yao Tech a publié votre campagne. Validez-la pour libérer les fonds.',
  at: '2026-10-01T10:00:00.000Z',
  r: false,
  link: '/c/c2',
};

describe('plateforme (e2e)', () => {
  it('un visiteur reçoit les options et onboarded=false', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlatformController],
      providers: [
        {
          provide: PlatformService,
          useValue: {
            snapshot: async (auth: unknown) => ({
              flags: { v2: true, v3: true },
              onboarded: Boolean(auth),
            }),
          },
        },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const response = await request(app.getHttpServer())
      .get('/api/platform')
      .expect(200);
    expect(response.body).toEqual({
      flags: { v2: true, v3: true },
      onboarded: false,
    });
    await app.close();
  });

  it('un non-admin reçoit 403 sur /admin/flags/v2', async () => {
    const app = await adminFlagsApp('brand');
    const response = await request(app.getHttpServer())
      .put('/api/admin/flags/v2')
      .send({ value: false })
      .expect(403);
    expect(response.body).toEqual({
      message: 'Action non autorisée pour ce compte.',
    });
    await app.close();
  });

  it('un annonceur ne voit que ses notifications', async () => {
    const listNotifications = vi
      .fn()
      .mockImplementation(async (auth: { profileId: string; role: string }) => {
        if (auth.role === 'admin') {
          return [
            {
              ...brandNotif,
              to: 'admin',
              t: 'Nouvelle inscription à vérifier.',
            },
          ];
        }
        return [brandNotif];
      });
    const brandApp = await notificationsApp('brand', { listNotifications });
    const brand = await request(brandApp.getHttpServer())
      .get('/api/notifications')
      .expect(200);
    expect(brand.body).toEqual([brandNotif]);
    expect(listNotifications).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'b1', role: 'brand' }),
    );
    await brandApp.close();

    const adminApp = await notificationsApp('admin', { listNotifications });
    const admin = await request(adminApp.getHttpServer())
      .get('/api/notifications')
      .expect(200);
    expect(admin.body[0].to).toBe('admin');
    await adminApp.close();
  });

  it('POST /notifications/read renvoie null et marque comme lues', async () => {
    const markRead = vi.fn().mockResolvedValue(null);
    const app = await notificationsApp('brand', { markRead });
    const response = await request(app.getHttpServer())
      .post('/api/notifications/read')
      .expect(200);
    expect(response.body).toBeNull();
    expect(markRead).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: 'b1' }),
    );
    await app.close();
  });

  it('PUT /me/preferences renvoie null', async () => {
    const setOnboarded = vi.fn().mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      controllers: [PreferencesController],
      providers: [
        { provide: PlatformService, useValue: { setOnboarded } },
        { provide: APP_GUARD, useClass: SessionGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.session = { userId: 'u1', role: 'brand', profileId: 'b1' } as never;
      next();
    });
    await app.init();
    const response = await request(app.getHttpServer())
      .put('/api/me/preferences')
      .send({ onboarded: true })
      .expect(200);
    expect(response.body).toBeNull();
    expect(setOnboarded).toHaveBeenCalledWith('u1');
    await app.close();
  });
});

async function adminFlagsApp(
  role: 'brand' | 'admin',
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [AdminFlagsController],
    providers: [
      {
        provide: FlagsService,
        useValue: { set: vi.fn().mockResolvedValue({ message: 'ok' }) },
      },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.session = {
      userId: 'u1',
      role,
      profileId: role === 'admin' ? 'admin' : 'b1',
    } as never;
    next();
  });
  await app.init();
  return app;
}

async function notificationsApp(
  role: 'brand' | 'admin',
  platform: Record<string, unknown>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [NotificationsController],
    providers: [
      { provide: PlatformService, useValue: platform },
      { provide: APP_GUARD, useClass: SessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.session = {
      userId: 'u1',
      role,
      profileId: role === 'admin' ? 'admin' : 'b1',
    } as never;
    next();
  });
  await app.init();
  return app;
}
