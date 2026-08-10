import { createClient } from '@supabase/supabase-js';
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
