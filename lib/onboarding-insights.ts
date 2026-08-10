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
): Promise<{ summary: string; source: 'ai' | 'rules' }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const facts = [
    `Range: ${input.rangeLabel}`,
    `Started: ${input.kpis.started}`,
    `Completed: ${input.kpis.completed}`,
    `In progress: ${input.kpis.inProgress}`,
    `Never started: ${input.kpis.neverStarted}`,
    `Completion rate: ${input.kpis.completionRate}%`,
    'Top drop-off steps:',
    ...input.dropOff.slice(0, 8).map(
      (r, i) =>
        `${i + 1}. ${r.stepId} — "${r.label}" (${r.chapterLabel}) — ${r.count} stuck`,
    ),
  ].join('\n');

  if (!apiKey) {
    return { summary: fallbackOnboardingInsights(input), source: 'rules' };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 180,
        messages: [
          {
            role: 'system',
            content:
              'You brief the FieldVision founder on onboarding health. Write 2 to 4 short sentences in plain spoken English. Name the worst drop-off screens by their question text, call out completion rate, and suggest the one most likely fix focus. No greetings, no bullets, no fluff.',
          },
          { role: 'user', content: `Onboarding facts:\n${facts}` },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty completion');
    return { summary: text, source: 'ai' };
  } catch {
    return { summary: fallbackOnboardingInsights(input), source: 'rules' };
  }
}
