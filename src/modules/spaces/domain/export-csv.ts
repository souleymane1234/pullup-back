import { NET, STATUS, type NetKey } from '../../../common/catalog.js';
import type { PresentedCampaign } from '../../campaigns/domain/present.js';

const HEADER = [
  'Référence',
  'Campagne',
  'Influenceur',
  'Réseau',
  'Format',
  'Montant FCFA',
  'Statut',
  'Vues',
  'Interactions',
  'Clics UTM',
  'Créée le',
];

export function campaignsCsv(campaigns: PresentedCampaign[]): string {
  const lines = [HEADER, ...campaigns.map(rowOf)];
  return lines.map((cols) => cols.map(csvCell).join(',')).join('\n');
}

function rowOf(campaign: PresentedCampaign): Array<string | number> {
  const perf = campaign.perf ?? {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    clicks: 0,
  };
  return [
    campaign.ref,
    campaign.brief.title,
    campaign.influencer.name,
    NET[campaign.offer.net as NetKey]?.l ?? campaign.offer.net,
    campaign.offer.fmt,
    campaign.amount,
    STATUS[campaign.status as keyof typeof STATUS]?.l ?? campaign.status,
    perf.views || 0,
    (perf.likes || 0) + (perf.comments || 0) + (perf.shares || 0),
    perf.clicks || 0,
    new Date(campaign.createdAt).toLocaleDateString('fr-FR'),
  ];
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
