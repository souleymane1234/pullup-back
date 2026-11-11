import { FlagsService } from './flags.service.js';

describe('FlagsService', () => {
  it('refuse une clé inconnue', async () => {
    const service = new FlagsService(
      { upsert: vi.fn() } as never,
      { del: vi.fn() } as never,
      { record: vi.fn() } as never,
    );
    await expect(service.set('v1', true, 'u1')).rejects.toMatchObject({
      message: 'Introuvable.',
    });
  });

  it('écrit le message V2 et invalide le cache', async () => {
    const redis = { del: vi.fn() };
    const audit = { record: vi.fn() };
    const flags = { upsert: vi.fn() };
    const service = new FlagsService(
      flags as never,
      redis as never,
      audit as never,
    );
    await expect(service.set('v2', false, 'admin')).resolves.toEqual({
      message:
        'V2 désactivée : les vitrines repassent en mode demande de devis.',
    });
    expect(redis.del).toHaveBeenCalledWith('flags');
    expect(audit.record).toHaveBeenCalled();
  });
});
