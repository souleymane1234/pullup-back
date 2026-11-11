import { createHmac, timingSafeEqual } from 'node:crypto';

export function signPayload(secret: string, rawBody: Buffer): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

export function signaturesMatch(
  secret: string,
  rawBody: Buffer,
  header: string | undefined,
): boolean {
  if (!secret || !header) {
    return false;
  }
  const expected = Buffer.from(signPayload(secret, rawBody), 'utf8');
  const received = Buffer.from(header, 'utf8');
  if (expected.length !== received.length) {
    return false;
  }
  return timingSafeEqual(expected, received);
}

export function secretsMatch(
  expected: string,
  received: string | undefined,
): boolean {
  if (!expected || !received) {
    return false;
  }
  const left = Buffer.from(expected, 'utf8');
  const right = Buffer.from(received, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
