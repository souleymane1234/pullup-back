import type { NextFunction, Request, Response } from 'express';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { AppError } from './app.error.js';

const WINDOW = 60;
const LIMIT = 120;

export function rateLimitMiddleware(redis: RedisService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/health' || req.path === '/health') {
      next();
      return;
    }
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const count = await redis.incr(`rl:${ip}`, WINDOW);
    res.setHeader('X-RateLimit-Limit', String(LIMIT));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, LIMIT - count)));
    if (count > LIMIT) {
      next(new AppError('Trop de requêtes. Réessayez dans une minute.', 429));
      return;
    }
    next();
  };
}
