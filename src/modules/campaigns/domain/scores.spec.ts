import { onTimeSample, ratingAfter } from './scores.js';

describe('scores campagne', () => {
  it('recalcule 4,8 avec 61 avis + 5 → 4,8', () => {
    expect(ratingAfter(4.8, 61, 5)).toEqual({ rating: 4.8, reviews: 62 });
  });

  it('note on_time selon brief_date + 24 h', () => {
    const published = new Date('2026-10-11T10:00:00Z');
    expect(onTimeSample(published, new Date('2026-10-10T12:00:00Z'))).toBe(100);
    expect(onTimeSample(published, new Date('2026-10-09T00:00:00Z'))).toBe(70);
    expect(onTimeSample(published, null)).toBe(100);
  });
});
