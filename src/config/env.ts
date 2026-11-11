import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean' ? value : value === 'true' || value === '1',
  );

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  // Redis commenté pour l'instant : l'URL n'est plus exigée.
  REDIS_URL: z.string().default(''),
  SESSION_SECRET: z.string().min(16),
  FRONT_ORIGIN: z.string().url(),
  S3_ENDPOINT: z.string().default(''),
  S3_BUCKET: z.string().default(''),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  S3_PUBLIC_URL: z.string().default(''),
  PAYMENT_PROVIDER: z.string().default('cinetpay'),
  PAYMENT_API_KEY: z.string().default(''),
  PAYMENT_SITE_ID: z.string().default(''),
  PAYMENT_WEBHOOK_SECRET: z.string().default(''),
  PAYMENT_CLIENT_ID: z.string().default(''),
  PAYMENT_CLIENT_SECRET: z.string().default(''),
  PAYMENT_API_URL: z.string().default('https://api.centralapis.com'),
  MAIL_API_KEY: z.string().default(''),
  MAIL_FROM: z.string().default('PULLUP <noreply@localhost>'),
  DEMO_MODE: booleanish.default(false),
  DEMO_PASSWORD: z.string().default(''),
  TURNSTILE_SECRET: z.string().default(''),
  WITHDRAW_DAILY_COUNT: z.coerce.number().int().positive().default(3),
  WITHDRAW_DAILY_FCFA: z.coerce.number().int().positive().default(500_000),
  WITHDRAW_KYC_FCFA: z.coerce.number().int().positive().default(1_000_000),
  SENTRY_DSN: z.string().default(''),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuration invalide : ${details}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.DEMO_MODE) {
    throw new Error('DEMO_MODE doit être false en production.');
  }
  return parsed.data;
}
