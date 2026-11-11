import type { AuthContext } from '../../auth/domain/session.js';

export interface NotificationView {
  to: string;
  t: string;
  at: string;
  r: boolean;
  link: string;
}

export function recipientKey(auth: AuthContext): string {
  return auth.role === 'admin' ? 'admin' : auth.profileId;
}

export function presentNotification(row: {
  recipientKey: string;
  text: string;
  link: string;
  readAt: Date | null;
  createdAt: Date;
}): NotificationView {
  return {
    to: row.recipientKey,
    t: row.text,
    at: row.createdAt.toISOString(),
    r: Boolean(row.readAt),
    link: row.link,
  };
}

export function isImportantEvent(text: string, link: string): boolean {
  const haystack = `${text} ${link}`.toLowerCase();
  return /campagne|séquestre|liber|litige|fonds/.test(haystack);
}
