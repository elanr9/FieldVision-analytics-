/**
 * The day the dashboard starts counting.
 *
 * Every loader in lib/ filters on this, so revenue, MRR, ARR, signups, trials, onboarding, paywall
 * and usage all start at zero here and only grow with what happens from this day on. Nothing older
 * is read, so nothing older can appear in a total, a chart bucket or a cohort.
 *
 * Moving this date forward resets the dashboard again; moving it back reveals the older history.
 */
export const ANALYTICS_EPOCH_ISO = '2026-10-02T00:00:00.000Z';

export const ANALYTICS_EPOCH = new Date(ANALYTICS_EPOCH_ISO);

/** Unix seconds, the form Stripe's list filters take. */
export const ANALYTICS_EPOCH_UNIX = Math.floor(ANALYTICS_EPOCH.getTime() / 1000);

/** Caption form, e.g. "Oct 2, 2026". Fixed to UTC so the server and the browser print the same day. */
export const ANALYTICS_EPOCH_LABEL = ANALYTICS_EPOCH.toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

/** True when the timestamp falls on or after the epoch. Null and empty values are never counted. */
export function isAfterEpoch(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= ANALYTICS_EPOCH.getTime();
}

/** The later of the given date and the epoch, for clamping a trailing window to the reset. */
export function fromEpoch(d: Date): Date {
  return d.getTime() < ANALYTICS_EPOCH.getTime() ? new Date(ANALYTICS_EPOCH) : d;
}

/** The later of the given timestamp and the epoch, as ISO, for Supabase `gte` filters. */
export function isoFromEpoch(iso: string): string {
  return fromEpoch(new Date(iso)).toISOString();
}
