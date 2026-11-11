import { RedisService } from '../../../infrastructure/redis/redis.service.js';
import { LoginThrottleService } from './login-throttle.service.js';

describe('LoginThrottleService', () => {
  it('bloque après 5 échecs', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('5'),
      incr: vi.fn(),
      del: vi.fn(),
    };
    const throttle = new LoginThrottleService(redis as unknown as RedisService);
    await expect(
      throttle.assertAllowed('1.1.1.1', 'a@b.ci'),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('autorise sous le plafond', async () => {
    const redis = {
      get: vi.fn().mockResolvedValue('2'),
      incr: vi.fn(),
      del: vi.fn(),
    };
    const throttle = new LoginThrottleService(redis as unknown as RedisService);
    await expect(
      throttle.assertAllowed('1.1.1.1', 'a@b.ci'),
    ).resolves.toBeUndefined();
  });
});
