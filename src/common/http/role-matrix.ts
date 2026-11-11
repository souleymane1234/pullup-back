import type { Role } from '../../modules/auth/domain/session.js';

export type Access = 'public' | 'auth' | readonly Role[];

export const ROLE_MATRIX: Array<{
  method: string;
  path: string;
  access: Access;
}> = [
  { method: 'GET', path: '/api/health', access: 'public' },
  { method: 'GET', path: '/api/docs', access: 'public' },
  { method: 'GET', path: '/api/metrics', access: 'public' },
  { method: 'GET', path: '/api/auth/session', access: 'public' },
  { method: 'POST', path: '/api/auth/login', access: 'public' },
  { method: 'POST', path: '/api/auth/signup/brand', access: 'public' },
  { method: 'GET', path: '/api/auth/handle', access: 'public' },
  { method: 'POST', path: '/api/auth/signup/influencer', access: 'public' },
  { method: 'POST', path: '/api/auth/demo', access: 'public' },
  { method: 'POST', path: '/api/auth/password/forgot', access: 'public' },
  { method: 'POST', path: '/api/auth/password/reset', access: 'public' },
  { method: 'POST', path: '/api/matching', access: 'public' },
  { method: 'GET', path: '/api/influencers', access: 'public' },
  { method: 'GET', path: '/api/platform', access: 'public' },
  { method: 'GET', path: '/api/catalog', access: 'public' },
  { method: 'GET', path: '/api/booking/:handle', access: 'public' },
  { method: 'POST', path: '/api/auth/logout', access: 'auth' },
  { method: 'GET', path: '/api/me/export', access: 'auth' },
  { method: 'DELETE', path: '/api/me', access: 'auth' },
  { method: 'PUT', path: '/api/me/preferences', access: 'auth' },
  { method: 'GET', path: '/api/notifications', access: 'auth' },
  { method: 'POST', path: '/api/notifications/read', access: 'auth' },
  { method: 'GET', path: '/api/campaigns', access: 'auth' },
  { method: 'GET', path: '/api/campaigns/:id', access: 'auth' },
  { method: 'POST', path: '/api/campaigns', access: ['brand'] },
  { method: 'POST', path: '/api/campaigns/:id/review', access: ['brand'] },
  {
    method: 'POST',
    path: '/api/campaigns/:id/messages',
    access: ['brand', 'influencer', 'admin'],
  },
  { method: 'POST', path: '/api/campaigns/:id/:action', access: 'auth' },
  { method: 'POST', path: '/api/uploads/brief', access: ['brand'] },
  { method: 'GET', path: '/api/r/:ref', access: 'public' },
  { method: 'GET', path: '/api/me/brand-space', access: ['brand'] },
  { method: 'GET', path: '/api/me/influencer-space', access: ['influencer'] },
  { method: 'PUT', path: '/api/me/brand', access: ['brand'] },
  { method: 'GET', path: '/api/me/campaigns.csv', access: ['brand'] },
  { method: 'PUT', path: '/api/billing/plan', access: ['brand'] },
  { method: 'POST', path: '/api/billing/boosts', access: ['influencer'] },
  { method: 'POST', path: '/api/wallet/withdrawals', access: ['influencer'] },
  { method: 'GET', path: '/api/payments/callback', access: 'public' },
  { method: 'POST', path: '/api/payments/callback', access: 'public' },
  {
    method: 'POST',
    path: '/api/payments/webhook/:provider',
    access: 'public',
  },
  { method: 'GET', path: '/api/admin/dashboard', access: ['admin'] },
  { method: 'GET', path: '/api/admin/catalog', access: ['admin'] },
  { method: 'POST', path: '/api/admin/catalog', access: ['admin'] },
  {
    method: 'PUT',
    path: '/api/admin/catalog/:kind/:key',
    access: ['admin'],
  },
  {
    method: 'DELETE',
    path: '/api/admin/catalog/:kind/:key',
    access: ['admin'],
  },
  { method: 'PUT', path: '/api/admin/flags/:key', access: ['admin'] },
  {
    method: 'POST',
    path: '/api/admin/campaigns/auto-validate',
    access: ['admin'],
  },
  {
    method: 'POST',
    path: '/api/admin/influencers/:id/verify',
    access: ['admin'],
  },
  {
    method: 'POST',
    path: '/api/admin/influencers/:id/reject',
    access: ['admin'],
  },
  {
    method: 'POST',
    path: '/api/admin/influencers/:id/suspend',
    access: ['admin'],
  },
  {
    method: 'POST',
    path: '/api/admin/influencers/:id/certify',
    access: ['admin'],
  },
  {
    method: 'PUT',
    path: '/api/admin/influencers/:id/scores',
    access: ['admin'],
  },
  { method: 'GET', path: '/api/admin/finance/summary', access: ['admin'] },
  { method: 'GET', path: '/api/admin/finance/ledger.csv', access: ['admin'] },
  { method: 'GET', path: '/api/admin/withdrawals', access: ['admin'] },
  {
    method: 'POST',
    path: '/api/admin/withdrawals/:id/retry',
    access: ['admin'],
  },
  { method: 'GET', path: '/api/admin/audit', access: ['admin'] },
  { method: 'POST', path: '/api/admin/brands/:id/credit', access: ['admin'] },
  {
    method: 'GET',
    path: '/api/campaigns/:id/payment',
    access: ['brand', 'influencer', 'admin'],
  },
];

export const ALL_ROLES: Role[] = ['brand', 'influencer', 'admin'];

export function expectedStatus(
  access: Access,
  role: Role | null,
): 200 | 401 | 403 {
  if (access === 'public') {
    return 200;
  }
  if (!role) {
    return 401;
  }
  if (access === 'auth') {
    return 200;
  }
  return access.includes(role) ? 200 : 403;
}

export function generatedMatrix() {
  return ROLE_MATRIX.flatMap((route) =>
    [null, ...ALL_ROLES].map((role) => ({
      ...route,
      role,
      status: expectedStatus(route.access, role),
    })),
  );
}
