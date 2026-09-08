/** Counts and shares that may be null because the athlete app does not emit the event yet. Nulls render as "—". */

export const DASH = '—';

export function count(n: number | null): string {
  return n === null ? DASH : String(n);
}

/** Whole-number share of `num` in `den`; null when either side is missing or `den` is 0. */
export function share(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den === 0) return null;
  return Math.round((num / den) * 100);
}

export function sharePct(num: number | null, den: number | null): string {
  const s = share(num, den);
  return s === null ? DASH : s + '%';
}

export function minus(n: number | null): string {
  return n === null ? DASH : n ? '−' + n : '0';
}
