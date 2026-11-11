import { signPayload } from './hmac.js';
import { FakeProvider } from './fake.provider.js';

describe('FakeProvider', () => {
  const provider = new FakeProvider('secret-test');

  it('simule réussite, échec et expiration', async () => {
    const ok = await provider.initCollect({
      reference: 'PU:ok',
      amount: 10000,
      method: 'om',
      description: 'test',
      customer: { name: 'A', email: 'a@b.ci' },
    });
    expect(ok.status).toBe('succeeded');
    expect(await provider.getCollectStatus(ok.providerRef)).toBe('succeeded');

    const fail = await provider.initCollect({
      reference: 'PU:fail',
      amount: 10000,
      method: 'mtn',
      description: 'test',
      customer: { name: 'A', email: 'a@b.ci' },
    });
    expect(await provider.getCollectStatus(fail.providerRef)).toBe('failed');

    const expire = await provider.initCollect({
      reference: 'PU:expire',
      amount: 10000,
      method: 'wave',
      description: 'test',
      customer: { name: 'A', email: 'a@b.ci' },
    });
    expect(await provider.getCollectStatus(expire.providerRef)).toBe('expired');

    const card = await provider.initCollect({
      reference: 'PU-card',
      amount: 10000,
      method: 'card',
      description: 'test',
      customer: { name: 'A', email: 'a@b.ci' },
    });
    expect(card.redirectUrl).toContain('https://pay.fake.test/card/');
    provider.simulateCollect(card.providerRef, 'succeeded');
    expect(await provider.getCollectStatus(card.providerRef)).toBe('succeeded');
  });

  it('vérifie la signature HMAC', () => {
    const body = Buffer.from('{"cpm_trans_id":"x"}');
    expect(
      provider.verifyWebhook(
        { 'x-webhook-signature': signPayload('secret-test', body) },
        body,
      ),
    ).toBe(true);
    expect(
      provider.verifyWebhook({ 'x-webhook-signature': 'nope' }, body),
    ).toBe(false);
  });
});
