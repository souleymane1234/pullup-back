import { PlatformService } from './platform.service.js';

describe('PlatformService', () => {
  it('donne onboarded=false à un visiteur', async () => {
    const service = new PlatformService(
      { list: vi.fn().mockResolvedValue({ v2: true, v3: false }) } as never,
      { find: vi.fn() } as never,
      { listFor: vi.fn() } as never,
    );
    await expect(service.snapshot()).resolves.toEqual({
      flags: { v2: true, v3: false },
      onboarded: false,
    });
    expect(service['preferences'].find).not.toHaveBeenCalled();
  });

  it('isole les notifications par destinataire', async () => {
    const listFor = vi.fn().mockResolvedValue([
      {
        recipientKey: 'b1',
        text: 'Publiée.',
        link: '/c/c2',
        readAt: null,
        createdAt: new Date('2026-10-01T10:00:00.000Z'),
      },
    ]);
    const markAllRead = vi.fn();
    const service = new PlatformService(
      {} as never,
      {} as never,
      { listFor, markAllRead } as never,
    );
    const items = await service.listNotifications({
      userId: 'u',
      role: 'brand',
      profileId: 'b1',
    });
    expect(listFor).toHaveBeenCalledWith('b1');
    expect(items[0]).toMatchObject({ to: 'b1', r: false });

    await service.listNotifications({
      userId: 'a',
      role: 'admin',
      profileId: 'admin',
    });
    expect(listFor).toHaveBeenCalledWith('admin');

    await service.markRead({ userId: 'u', role: 'brand', profileId: 'b1' });
    expect(markAllRead).toHaveBeenCalledWith('b1');
    await expect(
      service.markRead({ userId: 'u', role: 'brand', profileId: 'b1' }),
    ).resolves.toBeNull();
  });
});
