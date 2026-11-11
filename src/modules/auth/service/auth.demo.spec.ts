import { AuthService } from './auth.service.js';

describe('auth demo', () => {
  it('répond 404 si DEMO_MODE=false', async () => {
    const env = { get: (key: string) => (key === 'DEMO_MODE' ? false : '') };
    const auth = new AuthService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      env as never,
      {} as never,
      {} as never,
      { notify: async () => undefined },
      { send: async () => undefined },
      {
        saveSignupPhoto: async () => null,
        saveProfilePhoto: async () => '',
        deletePhoto: async () => undefined,
      },
    );
    await expect(
      auth.demo({ role: 'admin', id: 'admin' }, {} as never),
    ).rejects.toMatchObject({
      message: 'Introuvable.',
    });
  });
});
