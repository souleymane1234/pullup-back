import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../common/security/password.js';
import { normalizeEmail } from '../modules/auth/domain/email.js';

function pool(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  };
}

const email = normalizeEmail(process.argv[2] ?? '');
const password = process.argv[3] ?? '';
if (!email || password.length < 8) {
  console.error(
    'Usage : npm run admin:create -- email motdepasse (>= 8 caractères)',
  );
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(pool(process.env.DATABASE_URL!)),
});
const hash = await hashPassword(password);
await prisma.user.upsert({
  where: { email },
  update: { passwordHash: hash, role: 'admin', deletedAt: null },
  create: { email, passwordHash: hash, role: 'admin' },
});
console.log(`Admin prêt : ${email}`);
await prisma.$disconnect();
