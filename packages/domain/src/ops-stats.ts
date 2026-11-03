/** Percentile on pre-sorted numeric array (linear interpolation). */
export function percentileSorted(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo]!;
  const w = rank - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

export function percentilesFromValues(
  values: number[],
  ps: number[],
): Record<number, number | null> {
  const sorted = [...values].filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  const out: Record<number, number | null> = {};
  for (const p of ps) {
    out[p] = percentileSorted(sorted, p);
  }
  return out;
}

export function mean(values: number[]): number | null {
  const v = values.filter((n) => Number.isFinite(n));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}
