import { AppError } from '../../../common/http/app.error.js';
import {
  ACTION_RULES,
  CAMPAIGN_ACTIONS,
  assertTransition,
} from './transitions.js';

const STATUSES = [
  'awaiting_payment',
  'paid',
  'accepted',
  'published',
  'completed',
  'dispute',
  'declined',
  'cancelled',
  'refunded',
];
const ROLES = ['brand', 'influencer', 'admin'] as const;

describe('transitions de campagne', () => {
  it.each(CAMPAIGN_ACTIONS)(
    'autorise %s pour le bon rôle et le bon statut',
    (action) => {
      const rule = ACTION_RULES[action];
      expect(() =>
        assertTransition(action, rule.roles[0], rule.from[0], true),
      ).not.toThrow();
    },
  );

  it('refuse le mauvais rôle, le non-partie et le statut incorrect', () => {
    expect(() => assertTransition('accept', 'brand', 'paid', true)).toThrow(
      AppError,
    );
    expect(() =>
      assertTransition('accept', 'influencer', 'paid', false),
    ).toThrow(/autorisée/);
    expect(() =>
      assertTransition('accept', 'influencer', 'accepted', true),
    ).toThrow(/plus disponible/);
    expect(() => assertTransition('unknown', 'admin', 'paid', true)).toThrow(
      /introuvable/,
    );
  });

  it('couvre la matrice rôles × statuts', () => {
    let allowed = 0;
    let denied = 0;
    for (const action of CAMPAIGN_ACTIONS) {
      for (const role of ROLES) {
        for (const status of STATUSES) {
          try {
            assertTransition(action, role, status, true);
            expect(ACTION_RULES[action].roles.includes(role)).toBe(true);
            expect(ACTION_RULES[action].from.includes(status)).toBe(true);
            allowed += 1;
          } catch {
            denied += 1;
          }
        }
      }
    }
    expect(allowed).toBeGreaterThan(0);
    expect(denied).toBeGreaterThan(allowed);
  });
});
