import 'dotenv/config';
import { spawn } from 'node:child_process';
import { assertSeedAllowed } from './seed-guard.js';

try {
  assertSeedAllowed();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const child = spawn(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
  stdio: 'inherit',
  env: { ...process.env, SEED_RESET: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
