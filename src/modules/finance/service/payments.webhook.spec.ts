import { Prisma } from '@prisma/client';
import { AppError } from '../../../common/http/app.error.js';
import { FinanceEvents } from '../domain/events.js';
import { signPayload } from '../payment/hmac.js';
import { FakeProvider } from '../payment/fake.provider.js';
import { FinanceQueue } from './finance-queue.js';
import { PaymentsService } from './payments.service.js';

describe('webhook paiements', () => {
  const secret = 'hook-secret';
  const provider = new FakeProvider(secret);
  const events = new FinanceEvents();
  const queue = { enqueue: vi.fn() } as unknown as FinanceQueue;

  function service(db: Record<string, unknown>) {
    return new PaymentsService(
      db as never,
      {} as never,
      events,
      queue,
      provider,
    );
  }

  it('répond 401 si la signature est fausse', async () => {
    const payments = service({ webhookEvent: { create: vi.fn() } });
    const body = Buffer.from('{"event_id":"e1"}');
    await expect(
      payments.handleWebhook('fake', { 'x-webhook-signature': 'bad' }, body, {
        event_id: 'e1',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('n’a aucun effet la seconde fois', async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ id: 'w1' })
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );
    const payments = service({ webhookEvent: { create } });
    const body = Buffer.from('{"event_id":"e1","providerRef":"fake_x"}');
    const headers = { 'x-webhook-signature': signPayload(secret, body) };
    const first = await payments.handleWebhook('fake', headers, body, {
      event_id: 'e1',
      providerRef: 'fake_x',
    });
    const second = await payments.handleWebhook('fake', headers, body, {
      event_id: 'e1',
      providerRef: 'fake_x',
    });
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true, duplicate: true });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('accepte le jeton query du callback Central APIS', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'w1' });
    const payments = service({ webhookEvent: { create } });
    const body = Buffer.from(
      '{"transaction_id":"TXN-1","status":"SUCCESS","type":"CASHIN"}',
    );
    const result = await payments.handleWebhook(
      'central-apis',
      { 'x-callback-token': secret },
      body,
      { transaction_id: 'TXN-1', status: 'SUCCESS', type: 'CASHIN' },
    );
    expect(result).toEqual({ ok: true });
  });
});
