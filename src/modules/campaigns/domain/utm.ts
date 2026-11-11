import { NET, type NetKey } from '../../../common/catalog.js';

export function buildUtm(
  input: { ref: string; offerNet: string; briefLink?: string | null },
  handle: string,
): string {
  const base = (input.briefLink || 'https://votre-site.ci').split('?')[0];
  const medium =
    NET[input.offerNet as NetKey]?.l.toLowerCase() ?? input.offerNet;
  return `${base}?utm_source=pullup&utm_medium=${medium}&utm_campaign=${input.ref.toLowerCase()}&utm_content=${handle}`;
}
