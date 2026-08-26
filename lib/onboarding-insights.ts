import type { DropOffRow, OnboardingKpis } from './onboarding-analytics';

export interface OnboardingInsightsInput {
  kpis: OnboardingKpis;
  dropOff: DropOffRow[];
  rangeLabel: string;
}

export function fallbackOnboardingInsights(input: OnboardingInsightsInput): string {
  const { kpis, dropOff, rangeLabel } = input;
  if (kpis.started === 0) {
    return `No one in ${rangeLabel} started onboarding yet.`;
  }
  const top = dropOff.slice(0, 3);
  if (top.length === 0) {
    return `${kpis.completionRate}% of people who started onboarding in ${rangeLabel} finished it (${kpis.completed} of ${kpis.started}). Nobody is currently stuck mid-flow.`;
  }
  const worst = top
    .map(r => `"${r.label}" (${r.count})`)
    .join(', ');
  return `${kpis.completionRate}% completion among starters in ${rangeLabel} (${kpis.completed}/${kpis.started}). ${kpis.inProgress} still stuck. Highest drop-off: ${worst}.`;
}

export async function generateOnboardingInsights(
  input: OnboardingInsightsInput,
): Promise<{ summary: string; source: 'rules' }> {
  return { summary: fallbackOnboardingInsights(input), source: 'rules' };
}
