import {
  presentInfluencer,
  type InfluencerRecord,
} from '../../influencers/domain/present.js';

export function presentAdminInfluencer(
  record: InfluencerRecord,
  extra: { email: string; phone: string },
) {
  return {
    ...presentInfluencer(record, false),
    email: extra.email,
    phone: extra.phone,
  };
}

export function presentAdminBrand(brand: {
  id: string;
  name: string;
  contactName: string;
  user: { email: string };
  plan: string;
  sector: string;
  balanceFcfa: number;
}) {
  return {
    id: brand.id,
    name: brand.name,
    contact: brand.contactName,
    email: brand.user.email,
    plan: brand.plan,
    sector: brand.sector,
    balance: brand.balanceFcfa,
  };
}

export function ledgerCsv(
  rows: Array<{
    createdAt: Date;
    txId: string;
    accountType: string;
    accountId: string | null;
    campaignId: string | null;
    direction: string;
    amountFcfa: number;
    label: string;
  }>,
): string {
  const header = [
    'Date',
    'Écriture',
    'Compte',
    'Compte id',
    'Campagne',
    'Sens',
    'Montant FCFA',
    'Libellé',
  ];
  const lines = [
    header,
    ...rows.map((row) => [
      row.createdAt.toISOString(),
      row.txId,
      row.accountType,
      row.accountId ?? '',
      row.campaignId ?? '',
      row.direction,
      row.amountFcfa,
      row.label,
    ]),
  ];
  return lines.map((cols) => cols.map(csvCell).join(',')).join('\n');
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
