import { ANALYTICS_EPOCH } from './epoch';
import type { UserRecord } from './types';
import type { RevenueEvent, RevenueSnapshot } from './stripe-revenue';

/**
 * Overview numbers. Every builder takes the analytics epoch, so totals and chart buckets only
 * cover what happened on or after it; tests pass an older one to work with historical fixtures.
 */

export interface Bucket {
  label: string;
  /** Cents */
  revenue: number;
  signups: number;
  trials: number;
  paying: number;
  partial: boolean;
}

export interface Totals {
  /** Cents */
  revenue: number;
  payments: number;
  /** Cents */
  mrr: number;
  payingNow: number;
  payingEver: number;
  signups: number;
  trials: number;
  trialingNow: number;
  churned: number;
}

interface Period {
  label: string;
  start: Date;
  /** Exclusive */
  end: Date;
  partial: boolean;
}

const WEEKS_SHOWN = 12;

/**
 * Accounts the overview counts: real ones, signed up on or after the epoch. The loader already
 * stops at the epoch; keeping the rule here as well means every total in this file starts at zero
 * on that day no matter who passes the users in.
 */
function includedUsers(users: UserRecord[], epoch: Date): UserRecord[] {
  return users.filter(u => !u.excludedFromMetrics && new Date(u.signupDate).getTime() >= epoch.getTime());
}

/**
 * Payments the overview counts: taken on or after the epoch, and either unattributed or made by an
 * account the overview counts. A charge from someone who signed up before the epoch belongs to the
 * history the reset put away, the same way their subscription is left out of MRR.
 */
function includedEvents(included: UserRecord[], revenue: RevenueSnapshot, epoch: Date): RevenueEvent[] {
  const countedIds = new Set(included.map(u => u.id));
  return revenue.events.filter(
    e =>
      new Date(e.paidAt).getTime() >= epoch.getTime() &&
      (e.userId === null || countedIds.has(e.userId)),
  );
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function startOfWeek(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' });
}

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isWithin(iso: string | null, period: Period): boolean {
  if (iso === null) return false;
  const t = new Date(iso).getTime();
  return t >= period.start.getTime() && t < period.end.getTime();
}

function earliestSignup(users: UserRecord[], fallback: Date): Date {
  if (users.length === 0) return fallback;
  const times = users.map(u => new Date(u.signupDate).getTime());
  return new Date(Math.min(...times));
}

/** Charts begin at the epoch: a bucket that ended before the reset holds nothing worth drawing. */
function sinceEpoch(periods: Period[], epoch: Date): Period[] {
  return periods.filter(p => p.end.getTime() > epoch.getTime());
}

function laterOf(a: Date, b: Date): Date {
  return a.getTime() < b.getTime() ? b : a;
}

function monthPeriods(users: UserRecord[], now: Date, epoch: Date): Period[] {
  const current = startOfMonth(now);
  const periods: Period[] = [];
  for (let start = startOfMonth(laterOf(earliestSignup(users, now), epoch)); start <= current; start = addMonths(start, 1)) {
    periods.push({
      label: monthLabel(start),
      start,
      end: addMonths(start, 1),
      partial: start.getTime() === current.getTime(),
    });
  }
  return sinceEpoch(periods, epoch);
}

function weekPeriods(now: Date, epoch: Date): Period[] {
  const current = startOfWeek(now);
  const periods: Period[] = [];
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    periods.push({
      label: weekLabel(start),
      start,
      end: addDays(start, 7),
      partial: i === 0,
    });
  }
  return sinceEpoch(periods, epoch);
}

function bucketFor(period: Period, users: UserRecord[], events: RevenueEvent[]): Bucket {
  return {
    label: period.label,
    revenue: events.filter(e => isWithin(e.paidAt, period)).reduce((sum, e) => sum + e.cents, 0),
    signups: users.filter(u => isWithin(u.signupDate, period)).length,
    trials: users.filter(u => isWithin(u.trialStartedAt, period)).length,
    paying: users.filter(u => isWithin(u.paidAt, period)).length,
    partial: period.partial,
  };
}

export function buildMonths(users: UserRecord[], revenue: RevenueSnapshot, now: Date = new Date(), epoch: Date = ANALYTICS_EPOCH): Bucket[] {
  const included = includedUsers(users, epoch);
  const events = includedEvents(included, revenue, epoch);
  return monthPeriods(included, now, epoch).map(p => bucketFor(p, included, events));
}

export function buildWeeks(users: UserRecord[], revenue: RevenueSnapshot, now: Date = new Date(), epoch: Date = ANALYTICS_EPOCH): Bucket[] {
  const included = includedUsers(users, epoch);
  const events = includedEvents(included, revenue, epoch);
  return weekPeriods(now, epoch).map(p => bucketFor(p, included, events));
}

export function buildTotals(users: UserRecord[], revenue: RevenueSnapshot, epoch: Date = ANALYTICS_EPOCH): Totals {
  const included = includedUsers(users, epoch);
  const events = includedEvents(included, revenue, epoch);
  return {
    revenue: events.reduce((sum, e) => sum + e.cents, 0),
    payments: events.length,
    mrr: revenue.mrrCents,
    payingNow: included.filter(u => u.status === 'paying').length,
    payingEver: included.filter(u => u.paidAt !== null).length,
    signups: included.length,
    trials: included.filter(u => u.trialStartedAt !== null).length,
    trialingNow: included.filter(u => u.status === 'trialing').length,
    churned: included.filter(u => u.status === 'churned').length,
  };
}

export function buildOverview(
  users: UserRecord[],
  revenue: RevenueSnapshot,
  now: Date = new Date(),
  epoch: Date = ANALYTICS_EPOCH,
): { months: Bucket[]; weeks: Bucket[]; totals: Totals } {
  return {
    months: buildMonths(users, revenue, now, epoch),
    weeks: buildWeeks(users, revenue, now, epoch),
    totals: buildTotals(users, revenue, epoch),
  };
}
