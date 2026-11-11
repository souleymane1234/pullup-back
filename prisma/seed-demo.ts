import type { PrismaClient } from '@prisma/client';
import { COMMISSION } from '../src/common/catalog.js';
import { commissionOf, netAfterCommission } from '../src/common/money.js';
import {
  collectToEscrowLines,
  releaseEscrowLines,
  transfer,
  walletToPayoutLines,
  type CampaignMoney,
} from '../src/modules/finance/domain/ledger.js';
import { buildUtm } from '../src/modules/campaigns/domain/utm.js';
import { campaignSequenceName } from '../src/modules/references/domain/reference.js';
import { emailOf } from './seed-influencers.js';
import { clearLedgerEntries } from './seed-reset.js';

export function iso(daysAgo: number, hour = 10): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, 12, 0, 0);
  return date;
}

function money(
  id: string,
  brandId: string,
  influencerId: string,
  price: number,
  ref: string,
): CampaignMoney {
  return {
    id,
    brandId,
    influencerId,
    amount: price,
    fee: commissionOf(price, COMMISSION),
    payout: netAfterCommission(price, COMMISSION),
    ref,
  };
}

function post(prisma: PrismaClient, lines: ReturnType<typeof transfer>) {
  return prisma.ledgerEntry.createMany({
    data: lines.map((line) => ({
      txId: line.txId,
      accountType: line.accountType,
      accountId: line.accountId,
      campaignId: line.campaignId,
      direction: line.direction,
      amountFcfa: line.amountFcfa,
      label: line.label,
    })),
  });
}

export async function seedDemoExtras(prisma: PrismaClient) {
  const brands = await prisma.brand.findMany({ include: { user: true } });
  const influencers = await prisma.influencer.findMany({
    include: { user: true },
  });
  const byInf = Object.fromEntries(influencers.map((row) => [row.id, row]));
  const byBrand = Object.fromEntries(brands.map((row) => [row.id, row]));
  const i1 = byInf.i1!;
  const i2 = byInf.i2!;
  const i3 = byInf.i3!;
  const i10 = byInf.i10!;
  const b1 = byBrand.b1!;
  const b2 = byBrand.b2!;
  const b3 = byBrand.b3!;

  const c1 = money('c1', 'b1', 'i1', 90_000, 'PU-2410-137');
  const c2 = money('c2', 'b1', 'i3', 90_000, 'PU-2409-131');
  const c3 = money('c3', 'b1', 'i2', 50_000, 'PU-2409-118');
  const c4 = money('c4', 'b2', 'i1', 35_000, 'PU-2410-139');
  const c5 = money('c5', 'b3', 'i10', 85_000, 'PU-2409-125');

  await upsertCampaign(prisma, {
    money: c1,
    ref: 'PU-2410-137',
    status: 'paid',
    createdAt: iso(1),
    rate: i1.rates as Rate[],
    rateIndex: 1,
    brief: {
      title: 'Lancement du sérum Karité Glow',
      objective: 'notoriete',
      theme: 'beaute',
      text: 'Présenter le nouveau sérum au karité dans une routine du matin. Mentionner @savanecosmetics et le code GLOW10.',
      link: 'https://savane.ci/glow',
      date: iso(-3),
    },
    handle: i1.handle,
    events: [
      {
        status: 'paid',
        note: 'Paiement reçu · 90 000 FCFA bloqués en séquestre',
        at: iso(1),
      },
    ],
    messages: [
      {
        from: 'brand',
        userId: b1.userId,
        body: 'Bonjour Ama, le colis avec le sérum arrive chez vous demain avant 12 h.',
        at: iso(1, 12),
      },
    ],
  });

  await upsertCampaign(prisma, {
    money: c2,
    ref: 'PU-2409-131',
    status: 'published',
    createdAt: iso(6),
    publishedAt: iso(1),
    acceptedAt: iso(5),
    rate: i3.rates as Rate[],
    rateIndex: 0,
    brief: {
      title: 'Test du nouveau coffret Savane Men',
      objective: 'engagement',
      theme: 'beaute',
      text: 'Test honnête du coffret homme, focus sur la barbe et la peau.',
      link: 'https://savane.ci/men',
      date: iso(2),
    },
    handle: i3.handle,
    proof: {
      url: 'https://www.tiktok.com/@yaotech/video/7421',
      note: 'Vidéo en ligne depuis 26 h, épinglée sur le profil.',
      at: iso(1),
    },
    perf: {
      views: 96400,
      likes: 7310,
      comments: 412,
      shares: 388,
      clicks: 1240,
    },
    events: [
      {
        status: 'paid',
        note: 'Paiement reçu · fonds bloqués en séquestre',
        at: iso(6),
      },
      {
        status: 'accepted',
        note: 'Yao Tech a accepté la campagne',
        at: iso(5),
      },
      {
        status: 'published',
        note: 'Preuve de publication envoyée',
        at: iso(1),
      },
    ],
    messages: [
      {
        from: 'brand',
        userId: b1.userId,
        body: "Bonjour Yao, pensez à montrer le baume à barbe en gros plan, c'est notre produit phare.",
        at: iso(5, 11),
      },
      {
        from: 'influencer',
        userId: i3.userId,
        body: 'Bien noté ! Je tourne demain matin avec une lumière naturelle.',
        at: iso(5, 15),
      },
    ],
  });

  await upsertCampaign(prisma, {
    money: c3,
    ref: 'PU-2409-118',
    status: 'completed',
    createdAt: iso(14),
    publishedAt: iso(10),
    acceptedAt: iso(13),
    completedAt: iso(9),
    rate: i2.rates as Rate[],
    rateIndex: 2,
    brief: {
      title: 'Promo rentrée Savane',
      objective: 'trafic',
      theme: 'humour',
      text: 'Story humoristique sur la routine des élèves, lien vers la boutique.',
      link: 'https://savane.ci/rentree',
      date: iso(11),
    },
    handle: i2.handle,
    proof: {
      url: 'https://instagram.com/stories/legbakacomedy/31',
      note: 'Story + mise en avant.',
      at: iso(10),
    },
    perf: {
      views: 118200,
      likes: 9400,
      comments: 520,
      shares: 210,
      clicks: 2130,
    },
    events: [
      {
        status: 'paid',
        note: 'Paiement reçu · fonds bloqués en séquestre',
        at: iso(14),
      },
      { status: 'accepted', note: 'Acceptée', at: iso(13) },
      { status: 'published', note: 'Publiée', at: iso(10) },
      {
        status: 'completed',
        note: "Validée par l'annonceur · fonds libérés",
        at: iso(9),
      },
    ],
    review: {
      stars: 5,
      text: 'Sketch hilarant, plus de 2 000 clics sur notre lien. On refait vite !',
      at: iso(9),
      influencerId: 'i2',
      brandName: 'Savane Cosmetics',
    },
  });

  await upsertCampaign(prisma, {
    money: c4,
    ref: 'PU-2410-139',
    status: 'accepted',
    createdAt: iso(2),
    acceptedAt: iso(1),
    rate: i1.rates as Rate[],
    rateIndex: 0,
    brief: {
      title: 'Brunch du dimanche au Palmier',
      objective: 'conversion',
      theme: 'food',
      text: 'Story au brunch, avec le menu et la réservation par WhatsApp.',
      link: 'https://wa.me/2250700000000',
      date: iso(-1),
    },
    handle: i1.handle,
    events: [
      {
        status: 'paid',
        note: 'Paiement reçu · fonds bloqués en séquestre',
        at: iso(2),
      },
      {
        status: 'accepted',
        note: 'Ama Kouassi a accepté la campagne',
        at: iso(1),
      },
    ],
  });

  await upsertCampaign(prisma, {
    money: c5,
    ref: 'PU-2409-125',
    status: 'dispute',
    createdAt: iso(8),
    publishedAt: iso(4),
    acceptedAt: iso(7),
    rate: i10.rates as Rate[],
    rateIndex: 1,
    brief: {
      title: 'Ouvrir un compte Kalo en 2 minutes',
      objective: 'conversion',
      theme: 'business',
      text: "Live démonstration de l'ouverture de compte, avec lien de parrainage.",
      link: 'https://kalo.ci/app',
      date: iso(5),
    },
    handle: i10.handle,
    proof: {
      url: 'https://facebook.com/nadia.business/live/88',
      note: 'Live réalisé, 25 min au lieu de 30.',
      at: iso(4),
    },
    perf: { views: 21400, likes: 880, comments: 210, shares: 64, clicks: 610 },
    disputeReason: 'Le live a duré 25 minutes au lieu des 30 prévues.',
    events: [
      {
        status: 'paid',
        note: 'Paiement reçu · fonds bloqués en séquestre',
        at: iso(8),
      },
      { status: 'accepted', note: 'Acceptée', at: iso(7) },
      { status: 'published', note: 'Publiée', at: iso(4) },
      { status: 'dispute', note: "Litige ouvert par l'annonceur", at: iso(3) },
    ],
  });

  await clearLedgerEntries(prisma);
  await prisma.escrowHold.deleteMany({});
  await prisma.withdrawal.deleteMany({});
  await prisma.payout.deleteMany({});

  await post(
    prisma,
    transfer(
      'seed-b1',
      { type: 'external_psp', id: 'psp' },
      { type: 'brand_balance', id: 'b1' },
      35_000,
      'Solde initial démo',
    ),
  );
  for (const campaign of [c1, c2, c3, c4, c5]) {
    await post(prisma, collectToEscrowLines(campaign, campaign.amount));
  }
  await post(prisma, releaseEscrowLines(c3));
  await prisma.escrowHold.createMany({
    data: [c1, c2, c4, c5].map((campaign) => ({
      campaignId: campaign.id,
      brandId: campaign.brandId,
      influencerId: campaign.influencerId,
      amountFcfa: campaign.amount,
      feeFcfa: campaign.fee,
      payoutFcfa: campaign.payout,
      state: 'open' as const,
    })),
  });
  await prisma.escrowHold.create({
    data: {
      campaignId: c3.id,
      brandId: c3.brandId,
      influencerId: c3.influencerId,
      amountFcfa: c3.amount,
      feeFcfa: c3.fee,
      payoutFcfa: c3.payout,
      state: 'released',
    },
  });

  await post(
    prisma,
    transfer(
      'seed-i1-a',
      { type: 'external_psp', id: 'psp' },
      { type: 'influencer_wallet', id: 'i1' },
      76_500,
      'Campagne PU-2409-118 libérée',
    ),
  );
  await post(prisma, walletToPayoutLines('i1', 50_000, 'Retrait Orange Money'));
  await post(
    prisma,
    transfer(
      'seed-i1-b',
      { type: 'external_psp', id: 'psp' },
      { type: 'influencer_wallet', id: 'i1' },
      116_000,
      'Campagne PU-2409-131 libérée',
    ),
  );

  await prisma.wallet.update({
    where: { influencerId: 'i1' },
    data: { availableFcfa: 142_500 },
  });
  await prisma.wallet.update({
    where: { influencerId: 'i2' },
    data: { availableFcfa: c3.payout },
  });

  const payout = await prisma.payout.create({
    data: {
      id: 'po-seed-i1',
      purpose: 'withdrawal',
      targetId: 'i1',
      amountFcfa: 50_000,
      operator: 'om',
      phone: i1.phone || '0700000000',
      status: 'sent',
      rawPayload: {},
    },
  });
  await prisma.withdrawal.create({
    data: {
      influencerId: 'i1',
      amountFcfa: 50_000,
      operator: 'om',
      phone: i1.phone || '0700000000',
      payoutId: payout.id,
      status: 'sent',
      createdAt: iso(6),
    },
  });

  await prisma.notification.deleteMany({
    where: { recipientKey: { in: ['i1', 'b1', 'admin'] } },
  });
  await prisma.notification.createMany({
    data: [
      {
        recipientKey: 'i1',
        text: 'Nouvelle campagne de Savane Cosmetics : 90 000 FCFA bloqués en séquestre. Acceptez-la sous 72 h.',
        link: '/c/c1',
        createdAt: iso(1),
      },
      {
        recipientKey: 'b1',
        text: 'Yao Tech a publié votre campagne. Validez-la pour libérer les fonds.',
        link: '/c/c2',
        createdAt: iso(1),
      },
      {
        recipientKey: 'admin',
        text: 'Litige ouvert sur PU-2409-125 (Kalo Fintech × Nadia Business).',
        link: '/c/c5',
        createdAt: iso(3),
      },
    ],
  });

  const sequenceName = campaignSequenceName(new Date());
  await prisma.refSequence.upsert({
    where: { name: sequenceName },
    update: { value: 140 },
    create: { name: sequenceName, value: 140 },
  });

  return { emails: influencers.map((row) => emailOf(row.id, row.handle)) };
}

type Rate = { id: string; net: string; fmt: string; price: number };

async function upsertCampaign(
  prisma: PrismaClient,
  input: {
    money: CampaignMoney;
    ref: string;
    status: 'paid' | 'accepted' | 'published' | 'completed' | 'dispute';
    createdAt: Date;
    publishedAt?: Date;
    acceptedAt?: Date;
    completedAt?: Date;
    rate: Rate[];
    rateIndex: number;
    brief: {
      title: string;
      objective: string;
      theme: string;
      text: string;
      link: string;
      date: Date;
    };
    handle: string;
    proof?: { url: string; note: string; at: Date };
    perf?: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
      clicks: number;
    };
    disputeReason?: string;
    events: Array<{ status: string; note: string; at: Date }>;
    messages?: Array<{
      from: 'brand' | 'influencer';
      userId: string;
      body: string;
      at: Date;
    }>;
    review?: {
      stars: number;
      text: string;
      at: Date;
      influencerId: string;
      brandName: string;
    };
  },
) {
  const offer = input.rate[input.rateIndex]!;
  const data = {
    ref: input.ref,
    brandId: input.money.brandId,
    influencerId: input.money.influencerId,
    offerRateId: offer.id,
    offerNet: offer.net,
    offerFormat: offer.fmt,
    offerPrice: offer.price,
    amountFcfa: input.money.amount,
    feeFcfa: input.money.fee,
    payoutFcfa: input.money.payout,
    fromBalanceFcfa: 0,
    payMethod: 'om',
    status: input.status,
    briefTitle: input.brief.title,
    briefObjective: input.brief.objective,
    briefTheme: input.brief.theme,
    briefText: input.brief.text,
    briefLink: input.brief.link,
    briefDate: input.brief.date,
    utmUrl: buildUtm(
      { ref: input.ref, offerNet: offer.net, briefLink: input.brief.link },
      input.handle,
    ),
    proofUrl: input.proof?.url ?? null,
    proofNote: input.proof?.note ?? null,
    proofAt: input.proof?.at ?? null,
    perfViews: input.perf?.views ?? null,
    perfLikes: input.perf?.likes ?? null,
    perfComments: input.perf?.comments ?? null,
    perfShares: input.perf?.shares ?? null,
    perfClicks: input.perf?.clicks ?? null,
    disputeReason: input.disputeReason ?? null,
    acceptedAt: input.acceptedAt ?? null,
    publishedAt: input.publishedAt ?? null,
    completedAt: input.completedAt ?? null,
    createdAt: input.createdAt,
  };
  await prisma.campaign.upsert({
    where: { id: input.money.id },
    update: data,
    create: { id: input.money.id, ...data },
  });
  await prisma.campaignEvent.deleteMany({
    where: { campaignId: input.money.id },
  });
  await prisma.campaignEvent.createMany({
    data: input.events.map((event) => ({
      campaignId: input.money.id,
      status: event.status,
      note: event.note,
      createdAt: event.at,
    })),
  });
  await prisma.campaignMessage.deleteMany({
    where: { campaignId: input.money.id },
  });
  if (input.messages?.length) {
    await prisma.campaignMessage.createMany({
      data: input.messages.map((message) => ({
        campaignId: input.money.id,
        fromRole: message.from,
        authorUserId: message.userId,
        body: message.body,
        createdAt: message.at,
      })),
    });
  }
  if (input.review) {
    await prisma.review.deleteMany({ where: { campaignId: input.money.id } });
    await prisma.review.create({
      data: {
        campaignId: input.money.id,
        influencerId: input.review.influencerId,
        brandName: input.review.brandName,
        stars: input.review.stars,
        text: input.review.text,
        createdAt: input.review.at,
      },
    });
  }
}
