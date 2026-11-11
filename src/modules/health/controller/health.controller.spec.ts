import { ServiceUnavailableException } from '@nestjs/common';
import { UNAVAILABLE_MESSAGE } from '../../../common/http/app.error.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('répond 200 avec live et ready quand MySQL et Redis sont joignables', async () => {
    const health = {
      check: vi
        .fn()
        .mockResolvedValue({ live: true, ready: true, db: 'up', redis: 'up' }),
    };
    const controller = new HealthController(health as never);
    await expect(controller.livenessAndReadiness()).resolves.toEqual({
      live: true,
      ready: true,
      db: 'up',
      redis: 'up',
    });
  });

  it('répond 503 si la base ou Redis est down', async () => {
    const health = {
      check: vi.fn().mockResolvedValue({
        live: true,
        ready: false,
        db: 'down',
        redis: 'up',
      }),
    };
    const controller = new HealthController(health as never);
    await expect(controller.livenessAndReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(controller.livenessAndReadiness()).rejects.toThrow(
      UNAVAILABLE_MESSAGE,
    );
  });
});
