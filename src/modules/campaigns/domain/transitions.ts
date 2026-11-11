import { AppError, forbidden } from '../../../common/http/app.error.js';
import type { Role } from '../../auth/domain/session.js';

export const CAMPAIGN_ACTIONS = [
  'accept',
  'decline',
  'proof',
  'cancel',
  'validate',
  'dispute',
  'release',
  'refund',
] as const;
export type CampaignAction = (typeof CAMPAIGN_ACTIONS)[number];

export const ACTION_RULES: Record<
  CampaignAction,
  { roles: Role[]; from: string[] }
> = {
  accept: { roles: ['influencer'], from: ['paid'] },
  decline: { roles: ['influencer'], from: ['paid'] },
  proof: { roles: ['influencer'], from: ['accepted'] },
  cancel: { roles: ['brand'], from: ['paid', 'accepted'] },
  validate: { roles: ['brand', 'admin'], from: ['published'] },
  dispute: { roles: ['brand'], from: ['published'] },
  release: { roles: ['admin'], from: ['dispute'] },
  refund: { roles: ['admin'], from: ['dispute'] },
};

export function isCampaignAction(value: string): value is CampaignAction {
  return (CAMPAIGN_ACTIONS as readonly string[]).includes(value);
}

export function assertTransition(
  action: string,
  role: Role,
  status: string,
  party: boolean,
): CampaignAction {
  if (!isCampaignAction(action)) {
    throw new AppError('Campagne introuvable.', 404);
  }
  const rule = ACTION_RULES[action];
  if (!party && role !== 'admin') {
    throw forbidden();
  }
  if (!rule.roles.includes(role)) {
    throw forbidden();
  }
  if (!rule.from.includes(status)) {
    throw new AppError("Cette action n'est plus disponible.", 409);
  }
  return action;
}

export function isParty(
  auth: { role: string; profileId: string },
  campaign: { brandId: string; influencerId: string },
): boolean {
  return (
    auth.role === 'admin' ||
    auth.profileId === campaign.brandId ||
    auth.profileId === campaign.influencerId
  );
}
