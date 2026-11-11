import type { InfluencerRecord } from './present.js';
import type { AudienceJson, NetMap, RateJson } from './types.js';

export interface InfluencerRow {
  id: string;
  handle: string;
  name: string;
  city: string;
  bio: string;
  hue: number;
  photoUrl: string | null;
  verified: boolean;
  certified: boolean;
  status: string;
  acceptsPub: boolean;
  acceptsPartenariat: boolean;
  acceptsDedicace: boolean;
  scoreAuth: number;
  scoreCreat: number;
  scoreBrief: number;
  scoreOnTime: number;
  scoreRating: number;
  scoreReviews: number;
  scoreDone: number;
  nets: unknown;
  cats: unknown;
  audience: unknown;
  days: unknown;
  rates: unknown;
  qrScans: number;
  contactsCount: number;
  featuredUntil?: Date | null;
  analyticsUntil?: Date | null;
}

export function toRecord(
  row: InfluencerRow,
  views: number[],
): InfluencerRecord {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    city: row.city,
    cats: (row.cats as string[]) ?? [],
    bio: row.bio,
    net: (row.nets as NetMap) ?? {},
    aud: (row.audience as AudienceJson) ?? {
      f: 0,
      ages: [0, 0, 0, 0],
      cities: [],
    },
    auth: row.scoreAuth,
    creat: row.scoreCreat,
    brief: row.scoreBrief,
    onTime: row.scoreOnTime,
    rating: row.scoreRating,
    reviews: row.scoreReviews,
    done: row.scoreDone,
    rates: ((row.rates as RateJson[]) ?? []).map((rate) => ({
      id: rate.id,
      net: rate.net,
      fmt: rate.fmt,
      price: rate.price,
      archivedAt: rate.archivedAt ?? null,
    })),
    days: (row.days as string[]) ?? [],
    verified: row.verified,
    certified: row.certified,
    featured: Boolean(
      row.featuredUntil && row.featuredUntil.getTime() > Date.now(),
    ),
    analytics: Boolean(
      row.analyticsUntil && row.analyticsUntil.getTime() > Date.now(),
    ),
    status: row.status,
    accepts: {
      pub: row.acceptsPub,
      partenariat: row.acceptsPartenariat,
      dedicace: row.acceptsDedicace,
    },
    views,
    qr: row.qrScans,
    contacts: row.contactsCount,
    hue: row.hue,
    photo: row.photoUrl,
  };
}
