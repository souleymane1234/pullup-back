import { OriginGuard } from './origin.guard.js';

function context(
  method: string,
  origin?: string,
  path = '/api/system/erreur-metier',
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        originalUrl: path,
        headers: origin ? { origin } : {},
      }),
    }),
  };
}

describe('OriginGuard', () => {
  const guard = new OriginGuard({
    get: () => 'http://localhost:5173',
  } as never);

  it('laisse passer un GET', () => {
    expect(
      guard.canActivate(
        context('GET', 'https://site-hostile.example') as never,
      ),
    ).toBe(true);
  });

  it('refuse une origine étrangère sur une action', () => {
    expect(() =>
      guard.canActivate(
        context('POST', 'https://site-hostile.example') as never,
      ),
    ).toThrow(/Origine non autorisée/);
  });

  it('accepte FRONT_ORIGIN', () => {
    expect(
      guard.canActivate(context('POST', 'http://localhost:5173') as never),
    ).toBe(true);
  });

  it('laisse passer le callback Central APIS', () => {
    expect(
      guard.canActivate(
        context(
          'POST',
          'https://central-apis.example',
          '/api/payments/callback',
        ) as never,
      ),
    ).toBe(true);
  });
});
