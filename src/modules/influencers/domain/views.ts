export function utcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function dayKey(date: Date): string {
  return utcDay(date).toISOString().slice(0, 10);
}

export function last30Days(today = new Date()): Date[] {
  const end = utcDay(today);
  return Array.from({ length: 30 }, (_, index) => {
    const day = new Date(end);
    day.setUTCDate(end.getUTCDate() - (29 - index));
    return day;
  });
}

export function viewsSeries(
  rows: Array<{ day: Date; views: number }>,
  today = new Date(),
): number[] {
  const map = new Map(rows.map((row) => [dayKey(row.day), row.views]));
  return last30Days(today).map((day) => map.get(dayKey(day)) ?? 0);
}

export function seedViews(base: number, id: string): number[] {
  return Array.from({ length: 30 }, (_, day) =>
    Math.round(
      base *
        (0.65 + 0.5 * Math.abs(Math.sin(day * 1.7 + id.length)) + day / 60),
    ),
  );
}
