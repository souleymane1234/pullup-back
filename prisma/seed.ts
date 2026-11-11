import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/common/security/password.js';
import { assertSeedAllowed } from '../src/scripts/seed-guard.js';
import { seedCatalog } from './seed-catalog.js';
import { seedDemoExtras } from './seed-demo.js';
import { seedInfluencers } from './seed-influencers.js';
import { wipeDemo } from './seed-reset.js';

function pool(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    connectionLimit: 5,
    allowPublicKeyRetrieval: true,
  };
}

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(pool(process.env.DATABASE_URL!)),
});

async function upsertBrand(input: {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  contact: string;
  plan: 'free' | 'pro' | 'business';
  sector: string;
  balance: number;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { passwordHash: input.passwordHash, deletedAt: null },
    create: {
      email: input.email,
      passwordHash: input.passwordHash,
      role: 'brand',
    },
  });
  await prisma.brand.upsert({
    where: { userId: user.id },
    update: {
      id: input.id,
      name: input.name,
      contactName: input.contact,
      plan: input.plan,
      sector: input.sector,
      balanceFcfa: input.balance,
    },
    create: {
      id: input.id,
      userId: user.id,
      name: input.name,
      contactName: input.contact,
      plan: input.plan,
      sector: input.sector,
      balanceFcfa: input.balance,
    },
  });
}

async function main() {
  assertSeedAllowed();
  const password = process.env.DEMO_PASSWORD;
  if (!password) {
    throw new Error('DEMO_PASSWORD est requis pour le seed.');
  }
  if (process.env.SEED_RESET === '1') {
    await wipeDemo(prisma);
  }
  const hash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email: 'admin@pullup.net' },
    update: { passwordHash: hash, role: 'admin', deletedAt: null },
    create: { email: 'admin@pullup.net', passwordHash: hash, role: 'admin' },
  });

  await upsertBrand({
    id: 'b1',
    email: 'marketing@savane.ci',
    passwordHash: hash,
    name: 'Savane Cosmetics',
    contact: 'Aïcha Diomandé',
    plan: 'pro',
    sector: 'Cosmétique',
    balance: 35000,
  });
  await upsertBrand({
    id: 'b2',
    email: 'contact@lepalmier.ci',
    passwordHash: hash,
    name: 'Maquis Le Palmier',
    contact: 'Serge Koné',
    plan: 'free',
    sector: 'Restauration',
    balance: 0,
  });
  await upsertBrand({
    id: 'b3',
    email: 'growth@kalo.ci',
    passwordHash: hash,
    name: 'Kalo Fintech',
    contact: 'Ines Yapo',
    plan: 'business',
    sector: 'Fintech',
    balance: 0,
  });

  await seedCatalog(prisma);
  await seedInfluencers(prisma, hash);
  await seedDemoExtras(prisma);

  await prisma.featureFlag.upsert({
    where: { key: 'v2' },
    update: { value: true },
    create: { key: 'v2', value: true },
  });
  await prisma.featureFlag.upsert({
    where: { key: 'v3' },
    update: { value: true },
    create: { key: 'v3', value: true },
  });

  console.log('Comptes démo prêts (mot de passe lu depuis DEMO_PASSWORD).');
}

await main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
