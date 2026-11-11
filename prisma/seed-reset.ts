import type { PrismaClient } from '@prisma/client';
import mariadb from 'mariadb';

const LEDGER_NO_UPDATE = `CREATE TRIGGER ledger_entries_no_update
BEFORE UPDATE ON \`ledger_entries\`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is immutable'`;

const LEDGER_NO_DELETE = `CREATE TRIGGER ledger_entries_no_delete
BEFORE DELETE ON \`ledger_entries\`
FOR EACH ROW
SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ledger_entries is immutable'`;

function seedConnection() {
  const parsed = new URL(process.env.DATABASE_URL!);
  return mariadb.createConnection({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ''),
    allowPublicKeyRetrieval: true,
  });
}

/** Le grand livre est append-only : on lève les triggers uniquement pour le seed. */
export async function clearLedgerEntries(prisma: PrismaClient) {
  const conn = await seedConnection();
  try {
    await conn.query('DROP TRIGGER IF EXISTS ledger_entries_no_update');
    await conn.query('DROP TRIGGER IF EXISTS ledger_entries_no_delete');
    try {
      await prisma.ledgerEntry.deleteMany();
    } finally {
      await conn.query(LEDGER_NO_UPDATE);
      await conn.query(LEDGER_NO_DELETE);
    }
  } finally {
    await conn.end();
  }
}

/** Vide les tables métier dans l'ordre des clés étrangères (MySQL). */
export async function wipeDemo(prisma: PrismaClient) {
  await prisma.campaignMessage.deleteMany();
  await prisma.campaignEvent.deleteMany();
  await prisma.utmClick.deleteMany();
  await prisma.review.deleteMany();
  await prisma.contactRequest.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.profileViewDaily.deleteMany();
  await prisma.boostPurchase.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.escrowHold.deleteMany();
  await clearLedgerEntries(prisma);
  await prisma.payment.deleteMany();
  await prisma.payout.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.upload.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.userPreference.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.influencer.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.featureFlag.deleteMany();
  await prisma.refSequence.deleteMany();
  await prisma.user.deleteMany();
}
