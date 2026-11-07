export type DateBucket = { from: string; to: string };

export function countDistinct(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)).size;
}

export function calculateRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function calculateChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous < 0) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function averageElapsedHours(records: Array<{ submitted_at?: string | null; reviewed_at?: string | null }>): number | null {
  const durations = records.flatMap((record) => {
    if (!record.submitted_at || !record.reviewed_at) return [];
    const duration = (Date.parse(record.reviewed_at) - Date.parse(record.submitted_at)) / 3_600_000;
    return Number.isFinite(duration) && duration >= 0 ? [duration] : [];
  });
  return durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length : null;
}

export function createDateBuckets(from: string, to: string, stepDays: number): DateBucket[] {
  if (!Number.isInteger(stepDays) || stepDays < 1) throw new Error("Date bucket size must be a positive integer.");
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start > end) throw new Error("Date bucket range is invalid.");
  const buckets: DateBucket[] = [];
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + stepDays)) {
    const bucketEnd = new Date(cursor);
    bucketEnd.setUTCDate(bucketEnd.getUTCDate() + stepDays - 1);
    buckets.push({ from: cursor.toISOString().slice(0, 10), to: bucketEnd > end ? to : bucketEnd.toISOString().slice(0, 10) });
  }
  return buckets;
}

export function csvCell(value: string | number | null): string {
  let text = value === null ? "" : String(value);
  if (/^[\u0000-\u0020]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}
