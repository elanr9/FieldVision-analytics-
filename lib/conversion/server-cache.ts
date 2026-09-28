import { loadFunnel, loadPaywall, rangeForDays, type DateRange } from '../funnel';
import { loadUsers } from '../queries';
import type { UserRecord } from '../types';
import { buildBriefing, type InsightContext } from './ai';
import { loadConversionData } from './load';
import { buildConversionReport, type ConversionData } from './report';

const DATA_TTL_MS = 10 * 60 * 1000;
/** Onboarding screens are only tracked since August, so "all time" still reads the last year of events. */
const ALL_TIME_DAYS = 365;

export interface Loaded {
  users: UserRecord[];
  data: ConversionData;
}

let dataCache: { at: number; promise: Promise<Loaded> } | null = null;
const briefingCache = new Map<string, { at: number; promise: Promise<string> }>();

/** The conversion data is slow to build, so every AI route shares one copy for ten minutes. */
export function loadCachedConversion(refresh = false): Promise<Loaded> {
  if (!refresh && dataCache && Date.now() - dataCache.at < DATA_TTL_MS) return dataCache.promise;
  const promise = loadUsers().then(async users => ({ users, data: await loadConversionData(users) }));
  dataCache = { at: Date.now(), promise };
  promise.catch(() => {
    dataCache = null;
  });
  return promise;
}

/** Parses the tab's range param. null means all time. Throws on garbage. */
export function parseRange(param: string | null): { range: DateRange | null; days: number; key: string } {
  const key = param ?? 'all';
  if (key === 'all') return { range: null, days: ALL_TIME_DAYS, key };
  const days = Number(key);
  if (!Number.isFinite(days) || days <= 0) throw new Error('Bad range');
  return { range: rangeForDays(days), days, key };
}

/** Onboarding funnel and paywall for the range, tolerant of either failing. */
export async function loadContext(users: UserRecord[], days: number): Promise<InsightContext> {
  const [funnel, paywall] = await Promise.all([loadFunnel(days, users).catch(() => undefined), loadPaywall(days, users).catch(() => undefined)]);
  return { funnel, paywall };
}

/** The full data briefing the model reads, cached per range alongside the data. */
export function loadCachedBriefing(rangeKey: string, refresh = false): Promise<string> {
  const cached = briefingCache.get(rangeKey);
  if (!refresh && cached && Date.now() - cached.at < DATA_TTL_MS) return cached.promise;
  const promise = (async () => {
    const { range, days } = parseRange(rangeKey);
    const { users, data } = await loadCachedConversion(refresh);
    const report = buildConversionReport(data, range);
    const inRange = new Set(report.leaks[0]?.userIds ?? []);
    const cases = data.cases.filter(c => inRange.has(c.lifecycle.userId));
    return buildBriefing(data, report, cases, await loadContext(users, days));
  })();
  briefingCache.set(rangeKey, { at: Date.now(), promise });
  promise.catch(() => briefingCache.delete(rangeKey));
  return promise;
}
