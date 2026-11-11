export function ratingAfter(
  rating: number,
  reviews: number,
  stars: number,
): { rating: number; reviews: number } {
  const nextReviews = reviews + 1;
  const nextRating =
    Math.round(((rating * reviews + stars) / nextReviews) * 10) / 10;
  return { rating: nextRating, reviews: nextReviews };
}

export function nextQualityScore(
  current: number,
  doneBefore: number,
  sample: number,
): number {
  if (doneBefore <= 0) {
    return sample;
  }
  return Math.round((current * doneBefore + sample) / (doneBefore + 1));
}

export function onTimeSample(
  publishedAt: Date | null,
  briefDate: Date | null,
): number {
  if (!publishedAt || !briefDate) {
    return 100;
  }
  return publishedAt.getTime() <= briefDate.getTime() + 24 * 60 * 60 * 1000
    ? 100
    : 70;
}
