import { CentralApisProvider } from './central-apis.provider.js';

function env(values: Record<string, string>) {
  return {
    get: (key: string) => values[key] ?? '',
  } as never;
}

const credentials = {
  PAYMENT_CLIENT_ID: 'id-test',
  PAYMENT_CLIENT_SECRET: 'secret-test',
  PAYMENT_WEBHOOK_SECRET: 'hook-test',
  PAYMENT_API_URL: 'https://api.centralapis.com',
  FRONT_ORIGIN: 'http://localhost:5173',
};

describe('CentralApisProvider', () => {
  const provider = new CentralApisProvider(env(credentials));

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepte le jeton du callback ou les identifiants application', () => {
    const body = Buffer.from('{"etat":true}');
    expect(
      provider.verifyWebhook({ 'x-callback-token': 'hook-test' }, body),
    ).toBe(true);
    expect(provider.verifyWebhook({}, body)).toBe(true);
    expect(
      new CentralApisProvider(
        env({ PAYMENT_CLIENT_ID: '', PAYMENT_CLIENT_SECRET: '' }),
      ).verifyWebhook({}, body),
    ).toBe(false);
  });

  it('refuse la carte et Orange sans OTP', async () => {
    await expect(
      provider.initCollect({
        reference: 'pay1',
        amount: 1000,
        method: 'card',
        description: 'test',
        customer: { name: 'A', email: 'a@b.ci' },
      }),
    ).rejects.toThrow(/carte/i);
    await expect(
      provider.initCollect({
        reference: 'pay1',
        amount: 500,
        method: 'om',
        phone: '0700000000',
        description: 'test',
        customer: { name: 'A', email: 'a@b.ci' },
      }),
    ).rejects.toThrow(/#144\*82#/);
  });

  it('envoie un deposit MTN avec x-app-access et x-app-token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        etat: true,
        result: {
          partner_reference: 'pay1',
          transaction_reference: 'OP-9',
          typeTransaction: 'DEPOSIT',
          state: 'PENDING',
          service: 'mtn',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const started = await provider.initCollect({
      reference: 'pay1',
      amount: 90000,
      method: 'mtn',
      phone: '0500000000',
      description: 'Campagne',
      customer: { name: 'Savane', email: 'marketing@savane.ci' },
    });
    expect(started).toEqual({
      providerRef: 'pay1',
      status: 'pending',
      redirectUrl: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(url).toBe('https://api.centralapis.com/api/v1/finance/deposit');
    expect(init.headers['x-app-access']).toBe('id-test');
    expect(init.headers['x-app-token']).toBe('secret-test');
    expect(JSON.parse(init.body)).toEqual({
      numberClient: '0500000000',
      typeService: 'mtn',
      amount: 90000,
      reference: 'pay1',
    });
  });

  it('ajoute l’OTP Orange et les URLs Wave', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        etat: true,
        result: {
          partner_reference: 'pay2',
          state: 'INITIALISE',
          payment_url: 'wave://pay/abc',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await provider.initCollect({
      reference: 'pay2',
      amount: 500,
      method: 'om',
      phone: '0700000000',
      otp: '3210',
      description: 'Formule',
      customer: { name: 'A', email: 'a@b.ci' },
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).otp).toBe('3210');

    const wave = await provider.initCollect({
      reference: 'pay3',
      amount: 500,
      method: 'wave',
      phone: '0100000000',
      description: 'Formule',
      customer: { name: 'A', email: 'a@b.ci' },
    });
    expect(wave.redirectUrl).toBe('wave://pay/abc');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      typeService: 'wave',
      return_url: 'http://localhost:5173/paiement?status=success',
      cancel_url: 'http://localhost:5173/paiement?status=failure',
    });
  });

  it('consulte le statut par notre référence', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          etat: true,
          result: { partner_reference: 'pay1', state: 'DONE' },
        }),
      }),
    );
    await expect(provider.getCollectStatus('pay1')).resolves.toBe('succeeded');
  });
});
