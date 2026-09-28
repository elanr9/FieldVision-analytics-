import type { DateRange, Funnel, Paywall } from '../funnel';
import { FLOW_SECTIONS, flowScreens } from '../onboarding-flow';
import { formatUsd } from '../stripe-revenue';
import { OUTCOME_LABEL } from './lifecycle';
import { REASON_META } from './reasons';
import { buildConversionReport, type ChurnCase, type ConversionData, type ConversionReport } from './report';

/** What the model concludes about the whole funnel. */
export interface ChurnProblem {
  title: string;
  /** Where in the lifecycle it bites, e.g. "Day 1 of the trial" or "The paywall screen" */
  when: string;
  why: string;
  evidence: string[];
  severity: 'high' | 'medium' | 'low';
  /** Athletes this problem describes, so the UI can open them */
  userIds: string[];
}

export interface ChurnFix {
  title: string;
  /** The exact screen, flow step, email, or billing setting to change, e.g. "s37_paywall" or "Stripe dunning" */
  where: string;
  action: string;
  why: string;
  /** Expected effect in plain words, e.g. "Recovers most of the 9 failed cards, about $200/mo" */
  impact: string;
  effort: 'small' | 'medium' | 'large';
  /** Concrete build checklist, each item something an engineer or designer can pick up today */
  steps: string[];
  /** Titles of the problems this fix addresses */
  problems: string[];
}

/** Optional onboarding and paywall context so fixes can name real screens and steps. */
export interface InsightContext {
  funnel?: Funnel;
  paywall?: Paywall;
}

export interface ChurnInsights {
  /** One sentence, the single biggest truth in the data */
  headline: string;
  problems: ChurnProblem[];
  fixes: ChurnFix[];
  /** Questions worth asking lost athletes on a call */
  questionsToAsk: string[];
  model: string;
  generatedAt: string;
}

/** What the model concludes about one athlete. */
export interface CaseInsight {
  story: string;
  whyTheyLeft: string;
  whenItWentWrong: string;
  whatToDo: string;
  /** A short text message the founder could send today */
  message: string;
  model: string;
  generatedAt: string;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const insightsCache = new Map<string, { value: ChurnInsights; at: number }>();

/** The last diagnosis per range, so the agent chat can refer to the same problems and fixes the user sees. */
export function cachedInsights(rangeKey: string): ChurnInsights | null {
  return insightsCache.get(rangeKey)?.value ?? null;
}

/** Cache key shared by the diagnosis and the chat. */
export function insightsKey(range: DateRange | null): string {
  return range ? `${range.from.toISOString().slice(0, 10)}..${range.to.toISOString().slice(0, 10)}` : 'all';
}
const caseCache = new Map<string, { value: CaseInsight; at: number }>();

function apiKey(): string | null {
  const raw = process.env.OPENAI_API_KEY;
  if (!raw) return null;
  const key = raw.replace(/[^\x21-\x7e]/g, '');
  return key.length > 0 ? key : null;
}

export function openaiConfigured(): boolean {
  return apiKey() !== null;
}

function model(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o';
}

const SYSTEM_PROMPT = `You are the retention analyst for Inkbound, an app that helps youth soccer players get recruited by college coaches. Athletes go through a 38 screen onboarding flow, hit a paywall (s37_paywall, with a spin the wheel save offer s37c_spin_wheel and a one time offer s38_one_time_offer), start a 7 day free trial with a card on file, and either convert or leave. The app then sends coach emails on their behalf, tracks opens and replies, and makes highlight videos.

You are given real data: the onboarding funnel screen by screen, paywall numbers, per athlete lifecycles with what they did during their trial, Stripe billing facts, and deterministic rule based verdicts.

You have exactly two goals.
Goal 1: say precisely why athletes churn or never convert, and what that reveals about the product. Name the moment (which screen, which day of the trial, which billing event) and the mechanism (what the athlete expected, what they got instead).
Goal 2: propose real changes that would fix it. Every fix names the exact screen id or flow step or setting to change, what the new behavior is, and a build checklist. "Improve onboarding" is not a fix. "Move the card entry from s37_paywall to day 5 of the trial, replace the paywall CTA with Start free, add a day 5 push" is a fix.

Rules:
- Ground every claim in the data you were given. Quote counts and names. Never invent numbers.
- Distinguish moments: an onboarding screen, the paywall, day 1 of the trial, mid trial, trial end, after paying.
- Card failures and refunds are billing problems, not product problems. Say so and fix them with billing changes.
- Heavy users who still cancel are price or commitment problems. Fix them with pricing or plan changes.
- People who never used the trial are activation problems. Fix them inside the first session and the first 24 hours.
- Small numbers are fine. Say "3 of 8" rather than percentages when the base is under 20.
- Plain English, short sentences, no jargon, no dashes in your prose. Write like a sharp cofounder, not a consultant.
- userIds must be copied exactly from the data. Only include athletes whose facts match the problem.
- The founder is Elan. Any message you draft is from Elan, first person, and never contains placeholders.
- A headline is one sentence stating the biggest finding with its number, for example "68 athletes finished onboarding and walked away at the paywall, more than every trial loss combined." It is never a title.`;

const INSIGHTS_SCHEMA = {
  name: 'churn_insights',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['headline', 'problems', 'fixes', 'questionsToAsk'],
    properties: {
      headline: { type: 'string' },
      problems: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'when', 'why', 'evidence', 'severity', 'userIds'],
          properties: {
            title: { type: 'string' },
            when: { type: 'string' },
            why: { type: 'string' },
            evidence: { type: 'array', items: { type: 'string' } },
            severity: { type: 'string', enum: ['high', 'medium', 'low'] },
            userIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      fixes: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'where', 'action', 'why', 'impact', 'effort', 'steps', 'problems'],
          properties: {
            title: { type: 'string' },
            where: { type: 'string' },
            action: { type: 'string' },
            why: { type: 'string' },
            impact: { type: 'string' },
            effort: { type: 'string', enum: ['small', 'medium', 'large'] },
            steps: { type: 'array', items: { type: 'string' } },
            problems: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      questionsToAsk: { type: 'array', items: { type: 'string' } },
    },
  },
} as const;

const REPO_PROMPT_SCHEMA = {
  name: 'repo_prompt',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['repo', 'prompt'],
    properties: {
      repo: { type: 'string', enum: ['inkbound-web', 'inkbound-mobile', 'both', 'supabase'] },
      prompt: { type: 'string' },
    },
  },
} as const;

/** How the athlete apps are laid out, so repo prompts point at real places. */
const REPO_CONTEXT = `The product code lives in two repos that share one Supabase project:
- inkbound-web: Next.js 16 App Router, TypeScript. Onboarding flow in src/flow (flowConfig.ts, answers.ts, analytics.ts, sections/sectionN.tsx, screen ids like s37_paywall). App routes in src/app (onboarding, signup, login, parent, v). Feature code in src/features, shared UI in src/components, helpers in src/lib. Supabase edge functions in supabase/functions (stripe-webhook, inkbound-create-checkout, inkbound-confirm-checkout, inkbound-start-pro, cancel-subscription, resume-subscription, retention-offer, subscription-details, sync-subscription, billing-portal, send-coach-emails, auto-send-campaigns, campaign-followups, generate-next-campaign, send-notification-email, parent-invite-send, inkbound-parent-reminders, recruiting-chat, nl-school-search).
- inkbound-mobile: Expo 57, React Native 0.86, TypeScript. Same src/flow structure mirroring the web flow screen for screen, src/app for screens, src/components, src/lib, src/theme.
- Analytics events are written to the product_events table (onboarding_screen_view, onboarding_answer, page_view, feature_use, outreach_compose_open, outreach_email_send, highlight_open, school_view). Subscriptions live in user_subscriptions, profiles in user_profiles, trial start in user_profiles.trial_started_at.
Hard rule for any prompt: never modify edge functions or code related to highlight videos (video jobs, clips, video editor).`;

const CASE_SCHEMA = {
  name: 'case_insight',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['story', 'whyTheyLeft', 'whenItWentWrong', 'whatToDo', 'message'],
    properties: {
      story: { type: 'string' },
      whyTheyLeft: { type: 'string' },
      whenItWentWrong: { type: 'string' },
      whatToDo: { type: 'string' },
      message: { type: 'string' },
    },
  },
} as const;

function day(iso: string | null): string {
  return iso ? iso.slice(0, 10) : 'never';
}

/** One dense line per athlete, enough for the model to reason about a person without the full record. */
function caseLine(c: ChurnCase): string {
  const l = c.lifecycle;
  const e = l.engagement;
  const bits = [
    `id=${l.userId}`,
    `name=${l.name}`,
    `outcome=${l.outcome}`,
    c.verdict ? `rule_verdict=${c.verdict.reason}` : null,
    `signup=${day(l.signupAt)}`,
    l.trialStartAt ? `trial=${day(l.trialStartAt)}` : `onboarding=${l.onboarding}${l.onboardingStepLabel ? ` step="${l.onboardingStepLabel}"` : ''}`,
    l.planLabel ? `plan=${l.planLabel}${l.planAssumed ? '(assumed)' : ''}` : null,
    l.canceledAt ? `canceled=${day(l.canceledAt)} day${l.daysToCancel}` : null,
    l.firstChargeAt ? `charged=${day(l.firstChargeAt)}` : null,
    `emails=${e.emailsSent} replies=${e.repliesReceived} campaigns=${e.campaignsCreated} videos=${e.videosCreated} active_days=${e.activeDays}`,
    e.daysSilentBeforeEnd !== null ? `silent_days_before_end=${e.daysSilentBeforeEnd}` : null,
    l.lastSignInAt ? `last_sign_in=${day(l.lastSignInAt)}` : null,
    l.stripe ? `stripe=${l.stripe.status}${l.stripe.paymentFailed ? ' PAYMENT_FAILED' : ''}${l.stripe.refunded ? ' REFUNDED' : ''}${l.stripe.cancelFeedback ? ` feedback=${l.stripe.cancelFeedback}` : ''}${l.stripe.cancelComment ? ` comment="${l.stripe.cancelComment}"` : ''}` : null,
    l.warnings.length ? `warnings="${l.warnings.join('; ')}"` : null,
  ];
  return bits.filter(Boolean).join(' ');
}

function tally(items: (string | null)[]): string {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item ?? 'unknown', (counts.get(item ?? 'unknown') ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ');
}

function n(value: number | null): string {
  return value === null ? 'untracked' : String(value);
}

/** The live flow with drop per screen, so fixes can point at real screen ids. */
function funnelBriefing(funnel: Funnel | undefined, paywall: Paywall | undefined): string[] {
  const lines: string[] = ['## Onboarding flow, screen by screen'];
  if (funnel) {
    lines.push(`Started onboarding in range: ${funnel.started} (${funnel.startedSource === 'welcome_screen' ? 'saw the welcome screen' : 'accounts created with any flow event'}). Trials in range that converted: ${funnel.trialConverted}.`);
    for (const ch of funnel.chapters) {
      lines.push(`Section ${ch.label}: enter ${n(ch.enter)}, exit ${n(ch.exit)}`);
      for (const s of ch.steps) {
        if (s.reached === null) continue;
        lines.push(`  ${s.id} "${s.label}"${s.conditional ? ' (conditional)' : ''}: reached ${s.reached}${s.dropPct !== null ? `, dropped ${s.dropped} (${s.dropPct}%)` : ''}`);
      }
    }
    if (funnel.unknownScreens.length) lines.push(`Screens emitted but not in the mirror: ${funnel.unknownScreens.join(', ')}`);
  } else {
    lines.push(`Sections in order: ${FLOW_SECTIONS.map(s => `${s.number} ${s.label}`).join('; ')}`);
    lines.push(`Screens in order: ${flowScreens().map(s => `${s.id} "${s.label}"`).join(', ')}`);
  }
  if (paywall) {
    lines.push('', '## Paywall');
    lines.push(`Saw paywall ${n(paywall.seen)}, started trial directly ${n(paywall.trialDirect)}, closed paywall ${n(paywall.closed)}, entered wheel ${n(paywall.wheel.entered)}, spun ${n(paywall.wheel.spun)}, saw 90% offer ${n(paywall.wheel.offer90)}, offer trial ${n(paywall.wheel.trial)}, offer paid ${n(paywall.wheel.paid)}, idle 10 minutes on paywall ${n(paywall.stalled10m)}, save offer shown ${n(paywall.save.shown)}, accepted ${n(paywall.save.accepted)}.`);
    lines.push(`Plan tiles: ${paywall.plans.map(p => `${p.label} ${p.trials} trials, ${p.paid} paid`).join('; ')}`);
  }
  return lines;
}

/** Everything the model needs, kept compact: full lines for trial cases, tallies for people who never trialed. */
export function buildBriefing(data: ConversionData, report: ConversionReport, cases: ChurnCase[], context: InsightContext = {}): string {
  const trialCases = cases.filter(c => c.lifecycle.trialStartAt || c.lifecycle.outcome === 'converted' || c.lifecycle.outcome === 'paid_churned');
  const paywall = cases.filter(c => c.lifecycle.outcome === 'stopped_at_paywall');
  const abandoned = cases.filter(c => c.lifecycle.outcome === 'abandoned_onboarding');
  const h = report.headline;

  return [
    `## Funnel (${h.candidates} real athletes)`,
    report.leaks.map(s => `${s.label}: ${s.count}${s.dropPct !== null ? ` (lost ${s.dropPct}% from previous step)` : ''}`).join('\n'),
    '',
    `Trial to paid: ${h.trialToPaidPct}% (${h.converted} of ${h.trials}). Paid then churned: ${h.paidChurned}. Lost trial value if all had paid: ${formatUsd(h.lostMonthlyCents)}/mo. Median days to cancel: ${h.medianDaysToCancel ?? 'n/a'}.`,
    `Outcomes: ${report.outcomes.map(o => `${OUTCOME_LABEL[o.outcome]} ${o.count}`).join(', ')}`,
    `Rule based verdicts: ${report.reasons.map(r => `${REASON_META[r.reason].title} ${r.count}`).join(', ')}`,
    `Cancel timing: ${report.timeToCancel.map(b => `${b.label} ${b.count}`).join(', ')}`,
    `By plan: ${report.plans.map(p => `${p.label}: ${p.trials} trials, ${p.converted} paid, ${p.canceled} canceled`).join('; ')}`,
    `By signup month: ${report.cohorts.map(c => `${c.label}: ${c.signups} signups, ${c.trials} trials, ${c.converted} paid`).join('; ')}`,
    `Paid vs lost medians during the trial: paid sent campaign ${report.comparison.converters.activatedPct}% vs lost ${report.comparison.lost.activatedPct}%; emails ${report.comparison.converters.emailsSent} vs ${report.comparison.lost.emailsSent}; active days ${report.comparison.converters.activeDays} vs ${report.comparison.lost.activeDays}.`,
    report.stripeFeedback.length ? `Stripe cancel feedback: ${report.stripeFeedback.map(f => `${f.label} ${f.count}`).join(', ')}` : 'Stripe cancel feedback: none collected yet (survey is off).',
    report.warnings.length ? `Data warnings: ${report.warnings.map(w => `${w.text} (${w.userIds.length})`).join('; ')}` : '',
    data.stripe.configured ? '' : 'Stripe was not available, so cancel dates and card failures are inferred from Supabase only.',
    '',
    ...funnelBriefing(context.funnel, context.paywall),
    '',
    `## Stopped at the paywall (${paywall.length}, finished onboarding, never started a trial)`,
    `Signup months: ${tally(paywall.map(c => c.lifecycle.signupAt.slice(0, 7)))}`,
    `Came back after signup: ${paywall.filter(c => c.lifecycle.lastSignInAt && c.lifecycle.lastSignInAt.slice(0, 10) !== c.lifecycle.signupAt.slice(0, 10)).length}`,
    `ids: ${paywall.map(c => c.lifecycle.userId).join(',')}`,
    '',
    `## Abandoned onboarding (${abandoned.length})`,
    `Last screen seen: ${tally(abandoned.map(c => c.lifecycle.onboardingStepLabel))}`,
    `ids: ${abandoned.map(c => c.lifecycle.userId).join(',')}`,
    '',
    `## Every trial, one line each (${trialCases.length})`,
    ...trialCases.map(caseLine),
  ]
    .filter(line => line !== undefined)
    .join('\n');
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
}

type JsonSchema = typeof INSIGHTS_SCHEMA | typeof CASE_SCHEMA | typeof REPO_PROMPT_SCHEMA;

async function chat<T>(system: string, user: string, schema: JsonSchema): Promise<T> {
  const key = apiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model(),
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: schema },
    }),
  });
  const json = (await res.json()) as ChatResponse;
  if (!res.ok) throw new Error(json.error?.message ?? `OpenAI returned ${res.status}`);
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned an empty answer');
  return JSON.parse(content) as T;
}

/** Whole funnel diagnosis and fix plan. Cached for six hours per range. */
export async function generateChurnInsights(data: ConversionData, range: DateRange | null, refresh = false, context: InsightContext = {}): Promise<ChurnInsights> {
  const key = insightsKey(range);
  const cached = insightsCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const report = buildConversionReport(data, range);
  const inRange = new Set(report.leaks[0]?.userIds ?? []);
  const cases = data.cases.filter(c => inRange.has(c.lifecycle.userId));
  const briefing = buildBriefing(data, report, cases, context);
  const prompt = [
    'Goal 1: diagnose why and when athletes churn or fail to convert, and what each pattern says about the product.',
    'Goal 2: propose the specific changes that would fix it.',
    'Return 3 to 6 problems ordered by how much they cost us, 4 to 7 fixes ordered by impact for effort, and 3 to 5 questions to ask lost athletes on a call.',
    'Each problem names the moment it happens and lists the exact userIds it describes.',
    'Each fix names the exact screen id, flow step, message, or billing setting in `where` (for onboarding fixes that means the screen ids where people actually drop, taken from the funnel section), describes the new behavior in `action`, and gives 3 to 6 concrete build steps in `steps` that each change one specific thing.',
    '`impact` must be quantified from the data: how many of the named people it reaches and the monthly dollars at stake at the current trial to paid rate. Never answer "High" or "Medium".',
    'Cover onboarding, paywall, trial activation, billing recovery, and pricing where the data supports it. Write compound words without hyphens.',
    '',
    briefing,
  ].join('\n');

  const raw = await chat<Omit<ChurnInsights, 'model' | 'generatedAt'>>(SYSTEM_PROMPT, prompt, INSIGHTS_SCHEMA);
  const known = new Set(cases.map(c => c.lifecycle.userId));
  const value: ChurnInsights = {
    ...raw,
    problems: raw.problems.map(p => ({ ...p, userIds: p.userIds.filter(id => known.has(id)) })),
    model: model(),
    generatedAt: new Date().toISOString(),
  };
  insightsCache.set(key, { value, at: Date.now() });
  return value;
}

export interface RepoPrompt {
  repo: 'inkbound-web' | 'inkbound-mobile' | 'both' | 'supabase';
  prompt: string;
  model: string;
  generatedAt: string;
}

const repoPromptCache = new Map<string, { value: RepoPrompt; at: number }>();

/**
 * A paste ready prompt for Cursor or Claude Code inside the Inkbound repos that implements one fix.
 * Includes the evidence, the exact screens, the acceptance criteria, and the analytics events to add.
 */
export async function generateRepoPrompt(fix: ChurnFix, problems: ChurnProblem[], briefingSummary: string, refresh = false): Promise<RepoPrompt> {
  const key = fix.title + '|' + fix.where;
  const cached = repoPromptCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const related = problems.filter(p => fix.problems.includes(p.title));
  const prompt = [
    'Write one prompt that Elan can paste into Cursor or Claude Code, opened in the Inkbound repo, to implement the fix below. Pick the repo (web, mobile, both, or supabase for edge function and schema work).',
    'The prompt must: start with one paragraph of context (what the data showed, with the numbers); state the exact change with screen ids, files or folders to look in, and the new behavior; list acceptance criteria; name the product_events to add so the analytics dashboard can measure the change; say what not to touch; ask the agent to run typecheck and tests before finishing. Keep it under 450 words, plain English, no dashes.',
    '',
    REPO_CONTEXT,
    '',
    `## Fix\nTitle: ${fix.title}\nWhere: ${fix.where}\nAction: ${fix.action}\nWhy: ${fix.why}\nImpact: ${fix.impact}\nSteps:\n${fix.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
    '',
    related.length ? `## Problems it fixes\n${related.map(p => `${p.title} (${p.when}, ${p.userIds.length} people): ${p.why}\nEvidence: ${p.evidence.join('; ')}`).join('\n\n')}` : '',
    '',
    `## Data summary\n${briefingSummary}`,
  ].join('\n');

  const raw = await chat<Pick<RepoPrompt, 'repo' | 'prompt'>>(SYSTEM_PROMPT, prompt, REPO_PROMPT_SCHEMA);
  const value: RepoPrompt = { ...raw, model: model(), generatedAt: new Date().toISOString() };
  repoPromptCache.set(key, { value, at: Date.now() });
  return value;
}

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

const AGENT_SYSTEM_PROMPT = `You are Elan's product and go to market partner at Inkbound. Inkbound is a college soccer recruiting app: athletes onboard, start a 7 day trial with a card on file, then the app sends coach emails for them, tracks opens and replies, and makes highlight videos. Today the business is around $6k ARR with roughly 200 accounts. The product is strong; the two problems are that not enough athletes hear about it and small product leaks lose the ones who do.

You have the full conversion dataset below: funnel, onboarding screens, paywall, every trial with what the athlete did, Stripe billing facts, and rule based verdicts. Use it. Quote counts and names when they help. Never invent numbers.

How you work:
- Answer the question asked. Be direct, specific, and short. Short paragraphs, plain English, no jargon, no dashes in your prose, no bullet lists unless the answer really is a list.
- When asked for product changes, name the screen id or file area and the exact new behavior.
- When asked for go to market, think like an operator with no budget: who the buyer is (parents pay, athletes use), where they already are (club teams, tournaments, ID camps, coaches, TikTok, Instagram, parent group chats), referral loops built into the product, ambassadors, partnerships with clubs, content that ranks. Give concrete plays with a first step Elan can do today.
- When Elan asks for a prompt, or when a change is clearly code, write a paste ready prompt for Cursor or Claude Code inside a fenced code block, following the repo notes below. One prompt per fenced block. Prompts include context with numbers, exact change, acceptance criteria, product_events to add, what not to touch, and a request to run typecheck and tests.
- When asked for a message to an athlete or parent, write it from Elan in first person, ready to send, no placeholders.
- Push back when the data disagrees with the idea. Say what you would do instead.

${REPO_CONTEXT}`;

interface StreamChunk {
  choices?: { delta?: { content?: string | null } }[];
}

/**
 * Streams the agent's reply as plain text. The briefing is the same data the diagnosis reads,
 * so the conversation and the dashboard never disagree.
 */
export async function streamAgentReply(messages: AgentMessage[], briefing: string, insights: ChurnInsights | null): Promise<ReadableStream<Uint8Array>> {
  const key = apiKey();
  if (!key) throw new Error('OPENAI_API_KEY is not set');

  const system = [
    AGENT_SYSTEM_PROMPT,
    '',
    insights
      ? `## Current AI diagnosis\nHeadline: ${insights.headline}\nProblems: ${insights.problems.map(p => `${p.title} (${p.when}, ${p.userIds.length} people)`).join('; ')}\nFixes: ${insights.fixes.map((f, i) => `${i + 1}. ${f.title} at ${f.where}`).join('; ')}`
      : '',
    '',
    '## Data',
    briefing,
  ].join('\n');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model(),
      temperature: 0.5,
      stream: true,
      messages: [{ role: 'system', content: system }, ...messages.slice(-30).map(m => ({ role: m.role, content: m.content }))],
    }),
  });
  if (!res.ok || !res.body) {
    const json = (await res.json().catch(() => ({}))) as ChatResponse;
    throw new Error(json.error?.message ?? `OpenAI returned ${res.status}`);
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  return res.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const text = (JSON.parse(payload) as StreamChunk).choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // A partial JSON frame; the rest arrives with the next chunk.
          }
        }
      },
    }),
  );
}

/** One athlete's story, why and when they left, and what to send them. Cached for six hours. */
export async function generateCaseInsight(item: ChurnCase, refresh = false): Promise<CaseInsight> {
  const key = item.lifecycle.userId;
  const cached = caseCache.get(key);
  if (!refresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const prompt = [
    'Explain this one athlete. Tell the story in two or three sentences, then say exactly why and when they left, what we should do about them, and write a short friendly text message from the founder (first name basis, under 240 characters, one clear ask, no dashes).',
    item.verdict ? `Rule based verdict: ${REASON_META[item.verdict.reason].title}. Evidence: ${item.verdict.evidence.join('; ')}.` : 'This athlete has not been lost.',
    '',
    caseLine(item),
  ].join('\n');

  const raw = await chat<Omit<CaseInsight, 'model' | 'generatedAt'>>(SYSTEM_PROMPT, prompt, CASE_SCHEMA);
  const value: CaseInsight = { ...raw, model: model(), generatedAt: new Date().toISOString() };
  caseCache.set(key, { value, at: Date.now() });
  return value;
}
