import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const api = process.env.VITE_API_URL;
if (!api) {
  console.log(
    'test:contract ignoré : définissez VITE_API_URL (ex. http://localhost:4000/api).',
  );
  process.exit(0);
}

const front = resolve(process.cwd(), '../front');
if (!existsSync(front)) {
  console.error('Front introuvable à ../front');
  process.exit(1);
}

const child = spawn('npm', ['run', 'test', '--', 'src/app/pages.test.jsx'], {
  cwd: front,
  stdio: 'inherit',
  env: { ...process.env, VITE_API_URL: api },
});
child.on('exit', (code) => process.exit(code ?? 1));
