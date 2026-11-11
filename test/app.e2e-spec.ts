import '../src/test/setup-env.js';
import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { OriginGuard } from '../src/common/http/origin.guard.js';
import { HttpExceptionFilter } from '../src/common/http/http-exception.filter.js';
import { EnvService } from '../src/config/env.service.js';
import { SystemController } from '../src/modules/system/controller/system.controller.js';

describe('socle HTTP (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SystemController],
      providers: [EnvService, { provide: APP_GUARD, useClass: OriginGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/system/erreur-metier renvoie { message } en 422', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/system/erreur-metier')
      .set('Origin', 'http://localhost:5173')
      .expect(422);
    expect(response.body).toEqual({
      message: 'Cette action de test est volontairement refusée.',
    });
  });

  it('refuse une autre origine sur une action', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/system/erreur-metier')
      .set('Origin', 'https://site-hostile.example')
      .expect(403);
    expect(response.body).toEqual({ message: 'Origine non autorisée.' });
  });
});
