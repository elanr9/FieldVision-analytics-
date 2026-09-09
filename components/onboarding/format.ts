/** Counts and shares that may be null because the athlete app does not emit the event yet. Nulls render as "—". */

import type { StartedSource } from '@/lib/funnel';

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

/** How to describe the `started` cohort in captions, by how it was measured. */
export const STARTED_NOUN: Record<StartedSource, string> = {
  welcome_screen: 'who started',
  accounts_created: 'accounts created',
};

export const UNTRACKED_NOTE = 'screens before sign-in are not tracked yet';

export function minus(n: number | null): string {
  return n === null ? DASH : n ? '−' + n : '0';
}
