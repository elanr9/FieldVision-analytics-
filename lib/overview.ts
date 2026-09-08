import type { UserRecord } from './types';
import type { RevenueEvent, RevenueSnapshot } from './stripe-revenue';

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

function includedUsers(users: UserRecord[]): UserRecord[] {
  return users.filter(u => !u.excludedFromMetrics);
}

function includedEvents(users: UserRecord[], revenue: RevenueSnapshot): RevenueEvent[] {
  const excludedIds = new Set(users.filter(u => u.excludedFromMetrics).map(u => u.id));
  return revenue.events.filter(e => e.userId === null || !excludedIds.has(e.userId));
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

function monthPeriods(users: UserRecord[], now: Date): Period[] {
  const current = startOfMonth(now);
  const periods: Period[] = [];
  for (let start = startOfMonth(earliestSignup(users, now)); start <= current; start = addMonths(start, 1)) {
    periods.push({
      label: monthLabel(start),
      start,
      end: addMonths(start, 1),
      partial: start.getTime() === current.getTime(),
    });
  }
  return periods;
}

function weekPeriods(now: Date): Period[] {
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
  return periods;
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

export function buildMonths(users: UserRecord[], revenue: RevenueSnapshot, now: Date = new Date()): Bucket[] {
  const included = includedUsers(users);
  const events = includedEvents(users, revenue);
  return monthPeriods(included, now).map(p => bucketFor(p, included, events));
}

export function buildWeeks(users: UserRecord[], revenue: RevenueSnapshot, now: Date = new Date()): Bucket[] {
  const included = includedUsers(users);
  const events = includedEvents(users, revenue);
  return weekPeriods(now).map(p => bucketFor(p, included, events));
}

export function buildTotals(users: UserRecord[], revenue: RevenueSnapshot): Totals {
  const included = includedUsers(users);
  const events = includedEvents(users, revenue);
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
): { months: Bucket[]; weeks: Bucket[]; totals: Totals } {
  return {
    months: buildMonths(users, revenue, now),
    weeks: buildWeeks(users, revenue, now),
    totals: buildTotals(users, revenue),
  };
}
