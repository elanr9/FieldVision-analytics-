import { FLOW_SCREEN_DEFS, SHORT_FLOW_SCREEN_DEFS, type FlowScreenDef } from './onboarding-flow.generated';

/**
 * The live Inkbound onboarding (inkbound-web and inkbound-mobile src/flow). Screen ids and their order come
 * from the generated mirror; this file adds the section labels, readable screen labels and the merge that lets
 * screens the apps started emitting after the last sync still show up in the funnel.
 *
 * Two flows exist and the web app has switched between them: the classic 50-odd screen questionnaire
 * (s01 … s36b) and the short intake (n00 … n11, then the plan pitch p01, p02). Both end on the same paywall.
 */

/** Section keys are per flow; every flow ends in a section keyed 'paywall'. */
export type FlowSectionKey = string;
export const PAYWALL_SECTION_KEY = 'paywall';

export interface FlowSection {
  key: FlowSectionKey;
  /** Section number in the generated mirror. */
  number: number;
  label: string;
  /** Chip label for the chapter chart. */
  short: string;
}

export const FLOW_SECTIONS: FlowSection[] = [
  { key: 'welcome', number: 1, label: 'Welcome and feelings', short: 'Welcome' },
  { key: 'progress', number: 2, label: 'Progress check', short: 'Progress' },
  { key: 'academics', number: 3, label: 'Your academics', short: 'Academics' },
  { key: 'game', number: 4, label: 'Your game', short: 'Game' },
  { key: 'personal', number: 5, label: 'About you', short: 'You' },
  { key: 'plan', number: 6, label: 'Your plan', short: 'Plan' },
  { key: PAYWALL_SECTION_KEY, number: 7, label: 'Paywall', short: 'Paywall' },
];

export const SHORT_FLOW_SECTIONS: FlowSection[] = [
  { key: 'intake', number: 1, label: 'Quick intake', short: 'Intake' },
  { key: 'pitch', number: 2, label: 'Plan pitch', short: 'Pitch' },
  { key: PAYWALL_SECTION_KEY, number: 3, label: 'Paywall', short: 'Paywall' },
];

export type FlowKey = 'short' | 'classic';

export interface FlowDef {
  key: FlowKey;
  label: string;
  sections: FlowSection[];
  defs: FlowScreenDef[];
  /** A view of this screen is what "started" means. Earlier screens are entry points only some people pass. */
  startScreen: string;
  /** The account is created here; the apps hold earlier events on the device and write them once it exists. */
  accountScreen: string;
  /** Whether a screen id the mirror lacks belongs in this flow. */
  accepts: (id: string) => boolean;
}

/** First screen number of the paywall tail both flows share. */
const SHARED_TAIL_FROM = 37;

export const FLOWS: Record<FlowKey, FlowDef> = {
  short: {
    key: 'short',
    label: 'Short flow',
    sections: SHORT_FLOW_SECTIONS,
    defs: SHORT_FLOW_SCREEN_DEFS,
    startScreen: 'n01_role',
    accountScreen: 'n08_verify_phone',
    accepts: id => /^[np]\d/.test(id) || (id.startsWith('s') && screenOrderKey(id)[1] >= SHARED_TAIL_FROM),
  },
  classic: {
    key: 'classic',
    label: 'Full flow',
    sections: FLOW_SECTIONS,
    defs: FLOW_SCREEN_DEFS,
    startScreen: 's01_welcome',
    accountScreen: 's31_verify_phone',
    accepts: id => id.startsWith('s'),
  },
};

export const FLOW_KEYS: FlowKey[] = ['short', 'classic'];

/** Screens only one flow has: seeing one of them is what puts a person in that flow. */
export function exclusiveScreenIds(flow: FlowKey): Set<string> {
  const other = new Set(FLOWS[flow === 'short' ? 'classic' : 'short'].defs.map(d => d.id));
  return new Set(FLOWS[flow].defs.map(d => d.id).filter(id => !other.has(id)));
}

/** Which flow a screen id belongs to on its own; null for the paywall tail both share and for non-flow ids. */
export function flowOfScreen(id: string): FlowKey | null {
  if (!isFlowScreenId(id)) return null;
  if (/^[np]\d/.test(id)) return 'short';
  return id.startsWith('s') && screenOrderKey(id)[1] < SHARED_TAIL_FROM ? 'classic' : null;
}

/** Readable labels for known screens. Anything missing falls back to a humanized id, so new screens still read fine. */
const SCREEN_LABELS: Record<string, string> = {
  s01_welcome: 'Welcome',
  s02_role: 'Athlete or parent?',
  s03_invite_parent: 'Invite a parent',
  s04_gender: "Men's or women's soccer?",
  s05_feelings: 'How are you feeling?',
  s06_feeling_normal: 'Every feeling is normal',
  s07_heard_from: 'Where did you hear about us?',
  s08_worries: 'What worries you?',
  s09_confidence: 'How confident are you?',
  s10_researched: 'Researched programs?',
  s11_target_list: 'Target school list?',
  s12_emailed: 'Emailed coaches?',
  s13_replied: 'Coaches replied?',
  s13b_replied_schools: 'Which schools wrote back?',
  s14_video: 'Highlight video?',
  s15_offers: 'Any offers?',
  s16_offer_schools: 'Which schools made offers?',
  s17_academics_transition: 'Academics intro',
  s17b_school_type: 'High school or transfer?',
  s18_school: 'Your school',
  s19_grad_year: 'Graduation year',
  s19_eligibility: 'Years of eligibility left',
  s19_transfer_reasons: 'Why transfer?',
  s19b_on_track: "You're right on track",
  s19c_moving_fast: 'We have to move fast',
  s19d_get_moving: "It's time to get moving",
  s20_gpa: 'GPA',
  s21_tests: 'SAT or ACT?',
  s21b_scores: 'Test scores',
  s22_majors: 'What do you want to study?',
  s22_majors_transfer: "What's your major?",
  s23_game_transition: 'Game intro',
  s24_club_team: 'Club team',
  s25_league: 'League',
  s25b_prep_school: 'Prep school',
  s25c_prep_also_club: 'Also on a club team?',
  s25d_prep_club_details: 'Club details',
  s26_pro_experience: 'Pro experience',
  s27_position: 'Position',
  s28_athletics: 'Height, weight and foot',
  s29_stress_over: 'The stressful part is over',
  s30_about_you: 'A little about you',
  s30b_create_account: 'Create account',
  s31_verify_phone: 'Verify phone',
  s32_find_home: 'Find your perfect home',
  s33_goals: 'Your goals',
  s33b_invite_parent: 'Invite a parent',
  s34_building_plan: 'Building your plan',
  s35_plan_ready: 'Plan ready',
  s36_try_free: 'Try for free',
  s36b_trial_reminder: 'Trial reminder',
  s36c_who_pays: 'Who pays?',
  s36d_parent_billing: 'Parent billing',
  s37_paywall: 'Paywall',
  s37b_connecting: 'Connecting to checkout',
  s37c_spin_wheel: 'Spin the wheel',
  s37d_parent_invite_sent: 'Parent invite sent',
  s38_one_time_offer: '90% off one time offer',
  s25e_age_group: 'Club age group',
  s26b_pro_team: 'Pro team',
  s33b_commitment: 'How committed are you?',
  s37c_deal_wheel: 'Deal wheel',
  s37d_contact: 'Contact before checkout',
  s37d_parent_pay: 'Ask a parent to pay',
  s38_welcome: 'Welcome to Inkbound',
  n00_welcome: 'Welcome',
  n01_role: 'Athlete or parent?',
  n02_gender: "Men's or women's soccer?",
  n03_grad_year: 'Graduation year',
  n04_journey: 'Where are you in recruiting?',
  n05_videos: 'Highlight videos?',
  n06_commitment: 'How committed are you?',
  n07_about_you: 'Name and phone',
  n08_verify_phone: 'Verify phone',
  n09_athlete_info: "Athlete's info (parents)",
  n10_parent_helping: 'Is a parent helping?',
  n11_parent_note: 'Note to your parent',
  p01_next_steps: 'Your next steps',
  p02_cost_anchor: 'What recruiting costs',
};

export interface FlowScreen extends FlowScreenDef {
  label: string;
  /** False for screens seen in product_events that the mirror does not know yet. Run scripts/sync-onboarding-flow.mjs. */
  known: boolean;
}

const ID_PATTERN = /^([a-z])(\d+)([a-z]?)_(.+)$/;

/** Flow order of the id prefixes: the intake, the pitch, then the s-screens. */
const PREFIX_RANK: Record<string, number> = { c: 0, n: 1, p: 2, s: 3 };

/** Sort key for ids like s19b_on_track: [prefix rank, 19, 'b']. Ids without the prefix sort last. */
export function screenOrderKey(id: string): [number, number, string] {
  const m = ID_PATTERN.exec(id);
  return m ? [PREFIX_RANK[m[1]] ?? 9, Number(m[2]), m[3]] : [9, Number.MAX_SAFE_INTEGER, ''];
}

export function isFlowScreenId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function screenLabel(id: string): string {
  const known = SCREEN_LABELS[id];
  if (known) return known;
  const m = ID_PATTERN.exec(id);
  const words = (m ? m[4] : id).replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function sectionByNumber(number: number, sections: FlowSection[] = FLOW_SECTIONS): FlowSection {
  return sections.find(s => s.number === number) ?? sections[sections.length - 1];
}

function compareScreens(a: { id: string }, b: { id: string }): number {
  const [pa, na, la] = screenOrderKey(a.id), [pb, nb, lb] = screenOrderKey(b.id);
  return pa - pb || na - nb || la.localeCompare(lb);
}

/**
 * The flow in mirror order, with any observed screen ids the mirror lacks slotted in after the last known
 * screen that sorts before them. Unknown screens are treated as conditional so they never look like a drop.
 * `accepts` filters which unknown ids belong; by default any s-screen (the classic flow).
 */
export function flowScreens(
  observedIds: Iterable<string> = [],
  defs: FlowScreenDef[] = FLOW_SCREEN_DEFS,
  accepts: (id: string) => boolean = id => id.startsWith('s'),
): FlowScreen[] {
  const known = new Set(defs.map(d => d.id));
  const screens: FlowScreen[] = defs.map(d => ({ ...d, label: screenLabel(d.id), known: true }));
  const extras = [...new Set(observedIds)].filter(id => !known.has(id) && isFlowScreenId(id) && accepts(id)).sort((a, b) => compareScreens({ id: a }, { id: b }));
  for (const id of extras) {
    // The mirror keeps file order, which is not always id order, so place by neighbour rather than by sorting.
    let at = -1;
    for (let i = 0; i < screens.length; i++) if (compareScreens(screens[i], { id }) <= 0) at = i;
    const section = at >= 0 ? screens[at].section : screens[0]?.section ?? 1;
    screens.splice(at + 1, 0, { id, section, conditional: true, label: screenLabel(id), known: false });
  }
  return screens;
}

export interface ScreenPosition {
  id: string;
  label: string;
  chapter: FlowSectionKey;
  chapterLabel: string;
  /** Zero-based position among the flow's screens. */
  index: number;
  total: number;
}

/**
 * Where a screen sits in its flow, for "stuck at" lines. The paywall tail is shared, so `hint` says which
 * flow the person came through; without it the short flow is assumed for the tail. Null for non-flow ids.
 */
export function describeScreen(id: string, hint?: FlowKey | null): ScreenPosition | null {
  if (!isFlowScreenId(id)) return null;
  const flow = FLOWS[flowOfScreen(id) ?? hint ?? 'short'];
  const screens = flowScreens([id], flow.defs, flow.accepts);
  const index = screens.findIndex(s => s.id === id);
  if (index < 0) return null;
  const section = sectionByNumber(screens[index].section, flow.sections);
  return { id, label: screens[index].label, chapter: section.key, chapterLabel: section.label, index, total: screens.length };
}
