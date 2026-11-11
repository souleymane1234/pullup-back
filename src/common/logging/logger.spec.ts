import { afterEach, vi } from 'vitest';

describe('logger pino', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('écrit du JSON et masque e-mail et téléphone', async () => {
    const chunks: string[] = [];
    vi.spyOn(process.stdout, 'write').mockImplementation(((
      chunk: string | Uint8Array,
    ) => {
      chunks.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);

    const { logger } = await import('./logger.js');
    logger.info({
      msg: 'request',
      email: 'amakouassi@mail.ci',
      note: 'appeler 0700112233',
    });

    const line = chunks.join('');
    expect(line).toContain('"msg":"request"');
    expect(line).not.toContain('amakouassi@mail.ci');
    expect(line).toContain('a••@mail.ci');
    expect(line).not.toContain('0700112233');
  });
});
