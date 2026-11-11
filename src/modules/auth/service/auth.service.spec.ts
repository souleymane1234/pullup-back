import { AppError } from '../../../common/http/app.error.js';
import { verifyPassword } from '../../../common/security/password.js';
import { AuthService } from './auth.service.js';

vi.mock('../../../common/security/password.js', () => ({
  hashPassword: vi.fn(async () => 'hashed'),
  verifyPassword: vi.fn(async () => false),
}));

const brandUser = {
  id: 'u1',
  email: 'marketing@savane.ci',
  passwordHash: 'hashed',
  role: 'brand' as const,
  brand: {
    id: 'b1',
    name: 'Savane Cosmetics',
    contactName: 'Aïcha Diomandé',
    plan: 'pro',
  },
  influencer: null,
};

function mockReq() {
  const session: Record<string, unknown> = {
    id: 'old-sid',
    regenerate(cb: (err?: Error) => void) {
      session.id = 'new-sid';
      cb();
    },
    save(cb: (err?: Error) => void) {
      cb();
    },
    destroy(cb: (err?: Error) => void) {
      cb();
    },
  };
  return { ip: '10.0.0.1', headers: { 'user-agent': 'vitest' }, session };
}

function createAuth(overrides: Record<string, unknown> = {}) {
  const users = {
    findByEmail: vi.fn().mockResolvedValue(null),
    findById: vi.fn(),
    touchLogin: vi.fn(),
    updatePassword: vi.fn(),
    anonymize: vi.fn(),
  };
  const influencers = {
    findByHandle: vi.fn().mockResolvedValue(null),
    findById: vi.fn(),
    anonymize: vi.fn(),
  };
  const sessions = {
    create: vi.fn(),
    deleteById: vi.fn(),
    deleteByUser: vi.fn(),
  };
  const throttle = {
    assertAllowed: vi.fn(),
    recordFailure: vi.fn(),
    clear: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const prisma = { user: { create: vi.fn() } };
  const auth = new AuthService(
    users as never,
    { findById: vi.fn(), anonymize: vi.fn() } as never,
    influencers as never,
    sessions as never,
    { create: vi.fn(), findValid: vi.fn(), markUsed: vi.fn() } as never,
    throttle as never,
    {
      get: vi.fn((key: string) =>
        key === 'DEMO_MODE' ? true : 'http://localhost:5173',
      ),
    } as never,
    audit as never,
    prisma as never,
    { notify: vi.fn() } as never,
    { send: vi.fn() } as never,
    { saveSignupPhoto: vi.fn().mockResolvedValue(null) } as never,
  );
  return {
    auth,
    users,
    influencers,
    sessions,
    throttle,
    audit,
    prisma,
    ...overrides,
  };
}

async function expectAppError(
  promise: Promise<unknown>,
  status: number,
  message: string,
) {
  await expect(promise).rejects.toBeInstanceOf(AppError);
  try {
    await promise;
  } catch (error) {
    const err = error as AppError;
    expect(err.getStatus()).toBe(status);
    expect(err.getResponse()).toEqual({ message });
  }
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.mocked(verifyPassword).mockReset();
    vi.mocked(verifyPassword).mockResolvedValue(false);
  });

  it('refuse la connexion avec le même message si e-mail inconnu ou mot de passe faux', async () => {
    const { auth, users, throttle } = createAuth();
    users.findByEmail.mockResolvedValueOnce(null);
    await expectAppError(
      auth.login(
        { email: '  Unknown@Pullup.net ', password: 'secret12' },
        mockReq() as never,
      ),
      401,
      'Identifiants incorrects.',
    );
    expect(users.findByEmail).toHaveBeenCalledWith('unknown@pullup.net');
    expect(throttle.recordFailure).toHaveBeenCalled();

    users.findByEmail.mockResolvedValueOnce(brandUser);
    vi.mocked(verifyPassword).mockResolvedValueOnce(false);
    await expectAppError(
      auth.login(
        { email: 'marketing@savane.ci', password: 'bad-pass' },
        mockReq() as never,
      ),
      401,
      'Identifiants incorrects.',
    );
  });

  it('ouvre une nouvelle session et met à jour last_login_at', async () => {
    const { auth, users, sessions, throttle } = createAuth();
    users.findByEmail.mockResolvedValue(brandUser);
    vi.mocked(verifyPassword).mockResolvedValue(true);
    const req = mockReq();
    const result = await auth.login(
      { email: 'marketing@savane.ci', password: 'demo-pass' },
      req as never,
    );
    expect(result.message).toBe('Connecté : Savane Cosmetics');
    expect(result.session.id).toBe('b1');
    expect(result.session.avatar).toEqual({
      name: 'Savane Cosmetics',
      hue: 20,
    });
    expect(req.session.id).toBe('new-sid');
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'new-sid', userId: 'u1' }),
    );
    expect(users.touchLogin).toHaveBeenCalledWith('u1');
    expect(throttle.clear).toHaveBeenCalled();
  });

  it('refuse un e-mail déjà utilisé à l’inscription annonceur', async () => {
    const { auth, users } = createAuth();
    users.findByEmail.mockResolvedValue(brandUser);
    await expectAppError(
      auth.signupBrand(
        {
          company: 'Savane',
          contact: 'Aïcha Diomandé',
          email: 'marketing@savane.ci',
          password: 'secret12',
        },
        mockReq() as never,
      ),
      409,
      'Un compte existe déjà avec cet e-mail.',
    );
  });

  it('refuse un handle déjà pris', async () => {
    const { auth, influencers } = createAuth();
    influencers.findByHandle.mockResolvedValue({ id: 'i1' });
    await expectAppError(
      auth.signupInfluencer(
        {
          name: 'Ama',
          handle: 'amakouassi',
          email: 'ama@mail.ci',
          password: 'secret12',
          phone: '',
          city: 'Abidjan',
          bio: '',
          nets: { ig: 12000, tt: 0, fb: '', sc: '' },
          cats: ['beaute'],
          accepts: { pub: true, partenariat: true, dedicace: false },
          price: 15000,
        },
        mockReq() as never,
      ),
      409,
      "Ce nom d'utilisateur est déjà pris.",
    );
  });

  it('refuse un tarif sous 5 000 FCFA', async () => {
    const { auth } = createAuth();
    await expectAppError(
      auth.signupInfluencer(
        {
          name: 'Ama',
          handle: 'amakouassi',
          email: 'ama@mail.ci',
          password: 'secret12',
          phone: '',
          city: 'Abidjan',
          bio: '',
          nets: { ig: 12000, tt: 0, fb: '', sc: '' },
          cats: ['beaute'],
          accepts: { pub: true, partenariat: true, dedicace: false },
          price: 4000,
        },
        mockReq() as never,
      ),
      422,
      'Prix minimum 5 000 FCFA.',
    );
  });
});
