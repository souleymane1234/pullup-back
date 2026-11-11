import type { Request, Response } from 'express';
import { afterEach, vi } from 'vitest';

describe('requestLogger', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('journalise reqId, utilisateur et durée', async () => {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: string | Uint8Array,
    ) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    const { requestLogger } = await import('./request-logger.middleware.js');
    const listeners: Record<string, () => void> = {};
    const req = {
      headers: { 'x-request-id': 'req-demo-1' },
      method: 'GET',
      originalUrl: '/api/health?x=1',
      auth: { userId: 'admin' },
    } as unknown as Request;
    const res = {
      setHeader: vi.fn(),
      statusCode: 200,
      on: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
    } as unknown as Response;
    const next = vi.fn();

    requestLogger(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-demo-1');
    listeners.finish?.();

    const line = chunks.join('');
    expect(line).toContain('"msg":"request"');
    expect(line).toContain('"reqId":"req-demo-1"');
    expect(line).toContain('"user":"admin"');
    expect(line).toContain('"path":"/api/health"');
    expect(line).toContain('"ms":');
  });
});
