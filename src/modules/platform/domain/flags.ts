import { AppError } from '../../../common/http/app.error.js';

export const FLAG_KEYS = ['v2', 'v3'] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export const FEATURE_DISABLED =
  "Cette fonctionnalité n'est pas encore disponible.";

export function isFlagKey(value: string): value is FlagKey {
  return (FLAG_KEYS as readonly string[]).includes(value);
}

export function assertFlagKey(value: string): FlagKey {
  if (!isFlagKey(value)) {
    throw new AppError('Introuvable.', 404);
  }
  return value;
}

export function flagMessage(key: FlagKey, value: boolean): string {
  if (key === 'v2' && !value) {
    return 'V2 désactivée : les vitrines repassent en mode demande de devis.';
  }
  return `${key.toUpperCase()} ${value ? 'activée' : 'désactivée'} sur toute la plateforme.`;
}

export function defaultFlags(): Record<FlagKey, boolean> {
  return { v2: true, v3: true };
}
