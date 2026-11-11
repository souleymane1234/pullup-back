import { NET, type NetKey } from '../../../common/catalog.js';

export interface PerfEstimate {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

export function estimatePerf(
  followers: number,
  engagement: number,
  net: string,
  random: () => number = Math.random,
): PerfEstimate {
  const reach = NET[net as NetKey]?.reach ?? 0.3;
  const views = Math.round(followers * reach * (0.8 + random() * 0.4));
  const factor = (views * engagement) / 100;
  return {
    views,
    likes: Math.round(factor * 0.8),
    comments: Math.round(factor * 0.08),
    shares: Math.round(factor * 0.06),
    clicks: Math.round(views * 0.012),
  };
}
