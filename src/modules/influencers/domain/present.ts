import { pullupScore, type MetricInfluencer } from './metrics.js';
import { presentVitrineStats } from './stats.js';
import type { RateJson } from './types.js';

export interface InfluencerRecord extends MetricInfluencer {
  id: string;
  handle: string;
  name: string;
  city: string;
  cats: string[];
  bio: string;
  aud: { f: number; ages: number[]; cities: Array<[string, number]> };
  rating: number;
  reviews: number;
  done: number;
  rates: RateJson[];
  days: string[];
  accepts: { pub: boolean; partenariat: boolean; dedicace: boolean };
  views: number[];
  qr: number;
  contacts: number;
  hue: number;
  photo: string | null;
  certified: boolean;
  featured?: boolean;
  analytics?: boolean;
}

export function presentInfluencer(record: InfluencerRecord, favorite: boolean) {
  const rates = record.rates
    .filter((rate) => !rate.archivedAt)
    .map((rate) => ({
      id: rate.id,
      net: rate.net,
      fmt: rate.fmt,
      price: rate.price,
    }));
  return {
    id: record.id,
    handle: record.handle,
    name: record.name,
    city: record.city,
    cats: record.cats,
    bio: record.bio,
    net: record.net,
    aud: record.aud,
    auth: record.auth,
    creat: record.creat,
    brief: record.brief,
    onTime: record.onTime,
    rating: record.rating,
    reviews: record.reviews,
    done: record.done,
    rates,
    days: record.days,
    verified: record.verified,
    certified: record.certified,
    featured: Boolean(record.featured),
    analytics: Boolean(record.analytics),
    status: record.status,
    accepts: record.accepts,
    views: record.views,
    qr: record.qr,
    contacts: record.contacts,
    hue: record.hue,
    photo: record.photo,
    favorite,
    pullupScore: pullupScore(record),
    stats: presentVitrineStats(record),
  };
}

export function pageOf<T>(items: T[], cursor: number, limit: number) {
  const start = Math.max(0, cursor);
  const size = Math.min(48, Math.max(1, limit));
  return {
    items: items.slice(start, start + size),
    nextCursor: start + size < items.length ? start + size : null,
    total: items.length,
  };
}
