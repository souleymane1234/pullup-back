export function applyTestEnv(): void {
  process.env.NODE_ENV ||= 'test';
  process.env.DATABASE_URL ||= 'mysql://root:x@127.0.0.1:3306/pullup';
  process.env.REDIS_URL ||= 'redis://127.0.0.1:6379';
  process.env.SESSION_SECRET ||= 'session-secret-16';
  process.env.FRONT_ORIGIN ||= 'http://localhost:5173';
  process.env.DEMO_MODE ||= 'true';
  process.env.DEMO_PASSWORD ||= 'demo-pass';
  process.env.PAYMENT_WEBHOOK_SECRET ||= 'test-webhook-secret';
  process.env.PAYMENT_PROVIDER ||= 'fake';
}

applyTestEnv();
