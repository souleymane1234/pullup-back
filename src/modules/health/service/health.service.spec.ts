import { HealthService } from './health.service.js';

describe('HealthService', () => {
  it('est ready dès que MySQL répond, Redis étant commenté', async () => {
    const prisma = { $queryRaw: vi.fn().mockResolvedValue(1) };
    const redis = { ping: vi.fn().mockResolvedValue(true) };
    const health = new HealthService(prisma as never, redis as never);
    await expect(health.check()).resolves.toMatchObject({
      live: true,
      ready: true,
      db: 'up',
      redis: 'down',
    });
    expect(redis.ping).not.toHaveBeenCalled();
  });
});
