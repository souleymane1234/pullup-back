import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { noteHttpStatus } from '../metrics/alerts.js';
import { observeRequest } from '../metrics/metrics.js';
import { logger } from './logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const id = String(req.headers['x-request-id'] ?? randomUUID());
  req.requestId = id;
  res.setHeader('x-request-id', id);
  const started = Date.now();
  res.on('finish', () => {
    const userId = req.auth?.userId ?? req.session?.userId ?? null;
    const path = req.originalUrl.split('?')[0];
    const ms = Date.now() - started;
    observeRequest(path ?? '/', res.statusCode, ms);
    noteHttpStatus(res.statusCode);
    logger.info({
      msg: 'request',
      reqId: id,
      method: req.method,
      path,
      status: res.statusCode,
      ms,
      user: userId,
    });
  });
  next();
}
