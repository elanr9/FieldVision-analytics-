import {
  CHAPTER_LABELS,
  ONBOARDING_STEP_BY_ID,
  ONBOARDING_STEPS,
  type OnboardingChapter,
  type OnboardingStepDef,
  type OnboardingVisibilityFields,
  type ShowWhenRule,
} from './onboarding-steps';

export interface ResolvedOnboardingStep {
  stepId: string;
  stepIndex: number;
  totalSteps: number;
  chapter: OnboardingChapter;
  chapterLabel: string;
  kind: string;
  label: string;
}

function ruleMatches(
  rule: ShowWhenRule,
  fields: OnboardingVisibilityFields,
  isParent: boolean,
): boolean {
  if ('education' in rule) {
    const edu = fields.education_level ?? '';
    if (rule.education === 'high_school') return edu === 'High school';
    return edu === 'College';
  }
  if ('notCollegeAndNotHsOnly' in rule) {
    return fields.education_level !== 'College' && fields.league_level !== 'High School Only';
  }
  if ('notParent' in rule && rule.notParent) {
    if (isParent) return false;
    if (rule.field && rule.equals != null) {
      return String(fields[rule.field] ?? '') === rule.equals;
    }
    return true;
  }
  if ('field' in rule && rule.field) {
    return String(fields[rule.field] ?? '') === rule.equals;
  }
  return true;
}

export function isStepVisible(
  step: OnboardingStepDef,
  fields: OnboardingVisibilityFields,
  isParent: boolean,
): boolean {
  if (!step.showWhen) return true;
  return ruleMatches(step.showWhen, fields, isParent);
}

export function getVisibleSteps(
  fields: OnboardingVisibilityFields,
  isParent: boolean,
): OnboardingStepDef[] {
  return ONBOARDING_STEPS.filter(s => isStepVisible(s, fields, isParent));
}

export function labelForStep(step: OnboardingStepDef, isParent: boolean): string {
  if (isParent && step.parentQuestion) return step.parentQuestion;
  if (step.question) return step.question;
  if (step.lead) return step.lead;
  if (step.variant) return step.variant.replace(/-/g, ' ');
  return step.id;
}

/** Resolve stuck step from intake catalog index + visibility fields. */
export function resolveFromIntake(
  stepIndex: number | null,
  fields: OnboardingVisibilityFields,
  isParent: boolean,
): ResolvedOnboardingStep | null {
  if (stepIndex == null || stepIndex < 0) return null;

  const catalogStep = ONBOARDING_STEPS[stepIndex];
  if (!catalogStep) return null;

  const visible = getVisibleSteps(fields, isParent);
  const visibleIndex = visible.findIndex(s => s.id === catalogStep.id);

  return {
    stepId: catalogStep.id,
    stepIndex: visibleIndex >= 0 ? visibleIndex : stepIndex,
    totalSteps: visible.length,
    chapter: catalogStep.chapter,
    chapterLabel: CHAPTER_LABELS[catalogStep.chapter],
    kind: catalogStep.kind,
    label: labelForStep(catalogStep, isParent),
  };
}

/** Prefer event step_id; fall back to catalog lookup. */
export function resolveFromStepId(
  stepId: string,
  stepIndex: number | null,
  isParent: boolean,
): ResolvedOnboardingStep | null {
  const step = ONBOARDING_STEP_BY_ID.get(stepId);
  if (!step) return null;
  const catalogIndex = ONBOARDING_STEPS.findIndex(s => s.id === stepId);
  return {
    stepId: step.id,
    stepIndex: stepIndex ?? Math.max(0, catalogIndex),
    totalSteps: ONBOARDING_STEPS.length,
    chapter: step.chapter,
    chapterLabel: CHAPTER_LABELS[step.chapter],
    kind: step.kind,
    label: labelForStep(step, isParent),
  };
}

/** Derive onboarding status from intake plus stronger downstream signals. */
/** How far the new flow's screen events go for a user. The paywall is the flow's final screen. */
export type FlowProgress = 'none' | 'started' | 'reached_paywall';

/**
 * The legacy wizard writes user_onboarding_intake; the new flow writes product_events and
 * creates the account 31 screens in, so a brand new athlete at the paywall has events, no
 * intake and no name yet. Either source counts.
 */
export function deriveOnboardingStatus(
  intake: { completed: boolean } | undefined,
  trialStartedAt: string | null,
  hasFullPlan: boolean,
  flow: FlowProgress = 'none',
): 'none' | 'in_progress' | 'completed' {
  if (trialStartedAt || hasFullPlan || intake?.completed || flow === 'reached_paywall') return 'completed';
  if (intake || flow === 'started') return 'in_progress';
  return 'none';
}
