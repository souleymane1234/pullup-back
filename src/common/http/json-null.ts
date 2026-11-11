import type { Response } from 'express';

/** Nest serialize `return null` en `{}` ; le front attend le JSON `null`. */
export function sendJsonNull(res: Response) {
  return res.status(200).json(null);
}
