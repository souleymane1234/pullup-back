import pino from 'pino';
import { maskSecrets } from './mask.js';

const destination = {
  write(message: string) {
    process.stdout.write(
      maskSecrets(message.endsWith('\n') ? message : `${message}\n`),
    );
  },
};

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  destination,
);
