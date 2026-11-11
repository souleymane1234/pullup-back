import { MAX_BRIEF_WORDS } from '../../../common/catalog.js';
import { catalogLive } from '../../../common/catalog-live.js';
import { AppError } from '../../../common/http/app.error.js';
import { wordCount } from '../../influencers/domain/metrics.js';

export interface BriefInput {
  title: string;
  objective: string;
  theme: string;
  text: string;
  link?: string;
  date?: string;
  file?: string;
}

export function assertBrief(brief: BriefInput): {
  title: string;
  objective: string;
  theme: string;
  text: string;
  link: string;
  date: Date | null;
  file: string | null;
} {
  const title = brief.title.trim();
  if (!title) {
    throw new AppError('Donnez un nom à la campagne.', 422);
  }
  const text = brief.text.trim();
  const words = wordCount(text);
  if (words < 5) {
    throw new AppError("Ajoutez quelques consignes pour l'influenceur.", 422);
  }
  if (words > MAX_BRIEF_WORDS) {
    throw new AppError(`${MAX_BRIEF_WORDS} mots maximum.`, 422);
  }
  const link = (brief.link ?? '').trim();
  if (link && !/^https?:\/\//.test(link)) {
    throw new AppError('Le lien doit commencer par https://', 422);
  }
  const live = catalogLive();
  if (!(brief.objective in live.obj)) {
    throw new AppError('Objectif inconnu.', 422);
  }
  if (!(brief.theme in live.cats)) {
    throw new AppError('Thématique inconnue.', 422);
  }
  const rawDate = (brief.date ?? '').trim();
  let date: Date | null = null;
  if (rawDate) {
    date = new Date(`${rawDate}T00:00:00.000Z`);
    const today = new Date();
    const start = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    if (Number.isNaN(date.getTime()) || date.getTime() < start) {
      throw new AppError('La date doit être dans le futur.', 422);
    }
  }
  const file = (brief.file ?? '').trim();
  return {
    title,
    objective: brief.objective,
    theme: brief.theme,
    text,
    link: link || 'https://votre-site.ci',
    date,
    file: file && /^https?:\/\//.test(file) ? file : null,
  };
}

export function assertPhone(pay: string, phone?: string): string | undefined {
  if (pay === 'card') {
    return phone;
  }
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 8) {
    throw new AppError('Saisissez un numéro de téléphone valide.', 422);
  }
  return phone;
}
