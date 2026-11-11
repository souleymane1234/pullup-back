import argon2 from 'argon2';

const ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  if (!hash.startsWith('$argon2')) {
    return false;
  }
  return argon2.verify(hash, plain);
}
