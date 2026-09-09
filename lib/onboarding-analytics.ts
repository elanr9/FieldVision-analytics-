import { createClient } from '@supabase/supabase-js';
import { PAYWALL_EVENTS, PAYWALL_SCREENS } from './funnel';
import { CHAPTER_LABELS, ONBOARDING_STEP_BY_ID, type OnboardingChapter } from './onboarding-steps';
import type { UserRecord } from './types';

export interface DropOffRow {
  stepId: string;
  label: string;
  chapter: OnboardingChapter;
  chapterLabel: string;
  count: number;
}

export interface ChapterRollup {
  chapter: OnboardingChapter;
  label: string;
  count: number;
}

export interface OnboardingKpis {
  started: number;
  completed: number;
  inProgress: number;
  neverStarted: number;
  completionRate: number;
}

export interface StepConversion {
  stepId: string;
  label: string;
  viewed: number;
  completed: number;
  conversionRate: number;
}

export function computeOnboardingKpis(cohort: UserRecord[]): OnboardingKpis {
  const started = cohort.filter(u => u.onboarding !== 'none').length;
  const completed = cohort.filter(u => u.onboarding === 'completed').length;
  const inProgress = cohort.filter(u => u.onboarding === 'in_progress').length;
  const neverStarted = cohort.filter(u => u.onboarding === 'none').length;
  const completionRate = started === 0 ? 0 : Math.round((completed / started) * 1000) / 10;
  return { started, completed, inProgress, neverStarted, completionRate };
}

export function computeDropOff(cohort: UserRecord[]): DropOffRow[] {
  const counts = new Map<string, number>();
  for (const u of cohort) {
    if (u.onboarding !== 'in_progress') continue;
    const id = u.onboardingStepId ?? `unknown_${u.onboardingStepIndex ?? '?'}`;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([stepId, count]) => {
      const def = ONBOARDING_STEP_BY_ID.get(stepId);
      const chapter = (def?.chapter ?? 'basic') as OnboardingChapter;
      return {
        stepId,
        label: def ? (def.question ?? def.lead ?? stepId) : stepId,
        chapter,
        chapterLabel: CHAPTER_LABELS[chapter],
        count,
      };
    })
    .sort((a, b) => b.count - a.count || a.stepId.localeCompare(b.stepId));
}

export function computeChapterRollup(dropOff: DropOffRow[]): ChapterRollup[] {
  const counts = new Map<OnboardingChapter, number>();
  for (const row of dropOff) {
    counts.set(row.chapter, (counts.get(row.chapter) ?? 0) + row.count);
  }
  return (Object.keys(CHAPTER_LABELS) as OnboardingChapter[]).map(chapter => ({
    chapter,
    label: CHAPTER_LABELS[chapter],
    count: counts.get(chapter) ?? 0,
  }));
}

function adminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

interface ProductEventRow {
  name: string;
  properties: { step_id?: string } | null;
}

export interface StepView {
  userId: string;
  stepId: string;
}

interface StepViewRow {
  user_id: string | null;
  properties: { step_id?: unknown } | null;
}

interface EventUserRow {
  name: string;
  user_id: string | null;
}

const PAGE_SIZE = 1000;

/** Reads every matching row in pages so PostgREST's per-request row cap does not silently truncate a funnel. */
async function fetchAllPages<Row>(
  query: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await query(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** One row per `onboarding_step_viewed` event in range, keyed by the viewing user. */
export async function loadStepViews(fromIso: string, toIso: string): Promise<StepView[]> {
  const supabase = adminClient();
  const rows = await fetchAllPages<StepViewRow>((from, to) =>
    supabase
      .from('product_events')
      .select('user_id, properties')
      .eq('name', 'onboarding_step_viewed')
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .range(from, to),
  );
  const views: StepView[] = [];
  for (const row of rows) {
    const stepId = row.properties?.step_id;
    if (!row.user_id || typeof stepId !== 'string') continue;
    views.push({ userId: row.user_id, stepId });
  }
  return views;
}

export interface ScreenEvent {
  userId: string;
  /** Flow screen id, e.g. s37_paywall. */
  screen: string;
  kind: 'view' | 'answer';
}

interface ScreenEventRow {
  name: string;
  user_id: string | null;
  properties: { screen?: unknown } | null;
}

const SCREEN_EVENT_KIND: Record<string, ScreenEvent['kind']> = {
  onboarding_screen_view: 'view',
  onboarding_answer: 'answer',
};

/** Every live-flow screen view and answer in range (inkbound-web and inkbound-mobile src/flow/analytics.ts). */
export async function loadScreenEvents(fromIso: string, toIso: string): Promise<ScreenEvent[]> {
  const supabase = adminClient();
  const rows = await fetchAllPages<ScreenEventRow>((from, to) =>
    supabase
      .from('product_events')
      .select('name, user_id, properties')
      .in('name', Object.keys(SCREEN_EVENT_KIND))
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .range(from, to),
  );
  const events: ScreenEvent[] = [];
  for (const row of rows) {
    const screen = row.properties?.screen;
    const kind = SCREEN_EVENT_KIND[row.name];
    if (!row.user_id || typeof screen !== 'string' || !kind) continue;
    events.push({ userId: row.user_id, screen, kind });
  }
  return events;
}

/** Distinct users per event name in range. Names with no rows in range map to an empty set. */
export async function loadEventUsers(
  names: readonly string[],
  fromIso: string,
  toIso: string,
): Promise<Map<string, Set<string>>> {
  const supabase = adminClient();
  const rows = await fetchAllPages<EventUserRow>((from, to) =>
    supabase
      .from('product_events')
      .select('name, user_id')
      .in('name', [...names])
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .range(from, to),
  );
  const byName = new Map<string, Set<string>>(names.map(n => [n, new Set<string>()]));
  for (const row of rows) {
    if (row.user_id) byName.get(row.name)?.add(row.user_id);
  }
  return byName;
}

interface PaywallEventRow {
  name: string;
  user_id: string | null;
  properties: Record<string, unknown> | null;
}

interface StalledRow {
  user_id: string;
}

const PAYWALL_EVENT_NAMES = ['onboarding_screen_view', 'onboarding_answer', 'retention_offer_accepted'];

/** Maps one raw flow event to the paywall funnel signals it proves. */
export function derivePaywallKeys(row: PaywallEventRow): string[] {
  if (row.name === 'retention_offer_accepted') return [PAYWALL_EVENTS.saveOfferAccepted];
  const screen = typeof row.properties?.screen === 'string' ? row.properties.screen : null;
  if (!screen) return [];
  if (row.name === 'onboarding_screen_view') {
    switch (screen) {
      case PAYWALL_SCREENS.tryFree: return [PAYWALL_EVENTS.tryFreeViewed];
      case PAYWALL_SCREENS.paywall: return [PAYWALL_EVENTS.paywallViewed];
      case PAYWALL_SCREENS.wheel: return [PAYWALL_EVENTS.wheelViewed, PAYWALL_EVENTS.paywallClosed];
      case PAYWALL_SCREENS.offer: return [PAYWALL_EVENTS.offer90Viewed];
      default: return [];
    }
  }
  if (row.name === 'onboarding_answer') {
    const plan = typeof row.properties?.plan === 'string' ? row.properties.plan : null;
    switch (screen) {
      case PAYWALL_SCREENS.paywall: return plan ? [PAYWALL_EVENTS.tryFreeTapped, PAYWALL_EVENTS.checkoutStarted] : [];
      case PAYWALL_SCREENS.wheel: return [PAYWALL_EVENTS.wheelSpun];
      case PAYWALL_SCREENS.offer: return plan ? [PAYWALL_EVENTS.offerTrialStarted, PAYWALL_EVENTS.checkoutStarted] : [];
      default: return [];
    }
  }
  return [];
}

function addKeys(byKey: Map<string, Set<string>>, keys: string[], userId: string | null) {
  if (!userId) return;
  for (const key of keys) {
    let set = byKey.get(key);
    if (!set) {
      set = new Set();
      byKey.set(key, set);
    }
    set.add(userId);
  }
}

/** Distinct users per paywall signal in range, derived from flow events and the stalled feed rows. */
export async function loadPaywallKeyUsers(fromIso: string, toIso: string): Promise<Map<string, Set<string>>> {
  const supabase = adminClient();
  const [events, stalled] = await Promise.all([
    fetchAllPages<PaywallEventRow>((from, to) =>
      supabase
        .from('product_events')
        .select('name, user_id, properties')
        .in('name', PAYWALL_EVENT_NAMES)
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
    fetchAllPages<StalledRow>((from, to) =>
      supabase
        .from('analytics_notifications')
        .select('user_id')
        .eq('type', 'stalled')
        .gte('created_at', fromIso)
        .lte('created_at', toIso)
        .order('created_at', { ascending: true })
        .range(from, to),
    ),
  ]);
  const byKey = new Map<string, Set<string>>();
  for (const row of events) addKeys(byKey, derivePaywallKeys(row), row.user_id);
  for (const row of stalled) addKeys(byKey, [PAYWALL_EVENTS.paywallIdle10m], row.user_id);
  return byKey;
}

/** Which paywall signals have ever been produced, so a zero in range differs from a signal that does not exist yet. */
export async function loadSeenPaywallKeys(): Promise<Set<string>> {
  const supabase = adminClient();
  const [events, stalled] = await Promise.all([
    supabase
      .from('product_events')
      .select('name, user_id, properties')
      .in('name', PAYWALL_EVENT_NAMES)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase.from('analytics_notifications').select('user_id').eq('type', 'stalled').limit(1),
  ]);
  if (events.error) throw events.error;
  if (stalled.error) throw stalled.error;
  const seen = new Set<string>();
  for (const row of (events.data ?? []) as PaywallEventRow[]) {
    for (const key of derivePaywallKeys(row)) seen.add(key);
  }
  if ((stalled.data ?? []).length > 0) seen.add(PAYWALL_EVENTS.paywallIdle10m);
  return seen;
}

/** Which of the given event names the athlete app has ever emitted. Lets a zero in range differ from an event that does not exist yet. */
export async function loadSeenEventNames(names: readonly string[]): Promise<Set<string>> {
  const supabase = adminClient();
  const seen = new Set<string>();
  await Promise.all(
    names.map(async name => {
      const { data, error } = await supabase.from('product_events').select('name').eq('name', name).limit(1);
      if (error) throw error;
      if (data && data.length > 0) seen.add(name);
    }),
  );
  return seen;
}

/** Viewed → completed conversion per step_id from product_events. */
export async function loadStepConversions(
  fromIso: string,
  toIso: string,
): Promise<StepConversion[]> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from('product_events')
    .select('name, properties')
    .in('name', ['onboarding_step_viewed', 'onboarding_step_completed'])
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .limit(5000);

  if (error) throw error;

  const viewed = new Map<string, number>();
  const completed = new Map<string, number>();
  for (const row of (data ?? []) as ProductEventRow[]) {
    const stepId = row.properties?.step_id;
    if (!stepId || typeof stepId !== 'string') continue;
    if (row.name === 'onboarding_step_viewed') {
      viewed.set(stepId, (viewed.get(stepId) ?? 0) + 1);
    } else if (row.name === 'onboarding_step_completed') {
      completed.set(stepId, (completed.get(stepId) ?? 0) + 1);
    }
  }

  const ids = new Set([...viewed.keys(), ...completed.keys()]);
  return [...ids]
    .map(stepId => {
      const v = viewed.get(stepId) ?? 0;
      const c = completed.get(stepId) ?? 0;
      const def = ONBOARDING_STEP_BY_ID.get(stepId);
      return {
        stepId,
        label: def?.question ?? def?.lead ?? stepId,
        viewed: v,
        completed: c,
        conversionRate: v === 0 ? 0 : Math.round((c / v) * 1000) / 10,
      };
    })
    .sort((a, b) => b.viewed - a.viewed);
}
