import { AGES, NET } from '../../../common/catalog.js';
import {
  avgEngagement,
  clamp,
  pullupScore,
  type MetricInfluencer,
} from './metrics.js';
import type { AudienceJson } from './types.js';

type StatsSource = MetricInfluencer & { aud: AudienceJson; done: number };

export type VitrineBar = { key: string; label: string; value: number };
export type VitrineSlice = { label: string; value: number };

export type VitrineStats = {
  networks: Array<{
    key: string;
    label: string;
    followers: number;
    engagement: number;
  }>;
  audience: {
    cities: VitrineSlice[];
    ages: VitrineSlice[];
    gender: { women: number; men: number };
  };
  score: {
    value: number;
    bars: VitrineBar[];
    done: number;
    onTime: number;
    caption: string;
  };
};

/** Blocs vitrine prêts à afficher : réseaux, audience, âge, score PULLUP. */
export function presentVitrineStats(record: StatsSource): VitrineStats {
  const women = Math.round(Number(record.aud?.f) || 0);
  const men = Math.max(0, 100 - women);
  const ages = AGES.map((label, index) => ({
    label: `${label} ans`,
    value: Number(record.aud?.ages?.[index]) || 0,
  }));
  const cities = (record.aud?.cities ?? []).map(([label, value]) => ({
    label: String(label),
    value: Number(value) || 0,
  }));
  const engagementPct = Math.round(clamp(avgEngagement(record) / 7) * 100);
  const creatPct = Math.round(record.creat * 20);
  const done = Number(record.done) || 0;
  const onTime = Number(record.onTime) || 0;
  const value = pullupScore(record);
  const networks = Object.entries(record.net ?? {}).map(([key, tuple]) => ({
    key,
    label: NET[key as keyof typeof NET]?.l ?? key,
    followers: Number(tuple?.[0]) || 0,
    engagement: Number(tuple?.[1]) || 0,
  }));
  return {
    networks,
    audience: {
      cities,
      ages,
      gender: { women, men },
    },
    score: {
      value,
      bars: [
        { key: 'engagement', label: 'Engagement', value: engagementPct },
        { key: 'auth', label: 'Authenticité', value: record.auth },
        { key: 'creat', label: 'Créativité', value: creatPct },
        { key: 'brief', label: 'Briefs', value: record.brief },
        { key: 'onTime', label: 'Délais', value: onTime },
      ],
      done,
      onTime,
      caption: `${done} campagnes réalisées sur PULLUP · ${onTime} % publiées à l'heure · audience auditée quotidiennement.`,
    },
  };
}
