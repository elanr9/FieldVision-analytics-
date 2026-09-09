import { FLOW_SCREEN_DEFS, type FlowScreenDef } from './onboarding-flow.generated';

/**
 * The live Inkbound onboarding (inkbound-web and inkbound-mobile src/flow). Screen ids and their order come
 * from the generated mirror; this file adds the section labels, readable screen labels and the merge that lets
 * screens the apps started emitting after the last sync still show up in the funnel.
 */

export type FlowSectionKey = 'welcome' | 'progress' | 'academics' | 'game' | 'personal' | 'plan' | 'paywall';

export interface FlowSection {
  key: FlowSectionKey;
  /** FLOW.md section number. */
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
  { key: 'paywall', number: 7, label: 'Paywall', short: 'Paywall' },
];

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
};

export interface FlowScreen extends FlowScreenDef {
  label: string;
  /** False for screens seen in product_events that the mirror does not know yet. Run scripts/sync-onboarding-flow.mjs. */
  known: boolean;
}

const ID_PATTERN = /^s(\d+)([a-z]?)_(.+)$/;

/** Sort key for ids like s19b_on_track: [19, 'b']. Ids without the prefix sort last. */
export function screenOrderKey(id: string): [number, string] {
  const m = ID_PATTERN.exec(id);
  return m ? [Number(m[1]), m[2]] : [Number.MAX_SAFE_INTEGER, ''];
}

export function isFlowScreenId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function screenLabel(id: string): string {
  const known = SCREEN_LABELS[id];
  if (known) return known;
  const m = ID_PATTERN.exec(id);
  const words = (m ? m[3] : id).replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function sectionByNumber(number: number): FlowSection {
  return FLOW_SECTIONS.find(s => s.number === number) ?? FLOW_SECTIONS[FLOW_SECTIONS.length - 1];
}

function compareScreens(a: { id: string }, b: { id: string }): number {
  const [na, la] = screenOrderKey(a.id), [nb, lb] = screenOrderKey(b.id);
  return na - nb || la.localeCompare(lb);
}

/** Section for a screen the mirror does not know: the section of the last known screen that comes before it. */
function inferSection(id: string, defs: FlowScreenDef[]): number {
  let section = defs[0]?.section ?? 1;
  for (const def of defs) {
    if (compareScreens(def, { id }) <= 0) section = def.section;
    else break;
  }
  return section;
}

/**
 * The flow in order, with any observed screen ids the mirror lacks slotted in by their numeric prefix.
 * Unknown screens are treated as conditional so they never look like a drop.
 */
export function flowScreens(observedIds: Iterable<string> = [], defs: FlowScreenDef[] = FLOW_SCREEN_DEFS): FlowScreen[] {
  const known = new Set(defs.map(d => d.id));
  const screens: FlowScreen[] = defs.map(d => ({ ...d, label: screenLabel(d.id), known: true }));
  for (const id of new Set(observedIds)) {
    if (known.has(id) || !isFlowScreenId(id)) continue;
    screens.push({ id, section: inferSection(id, defs), conditional: true, label: screenLabel(id), known: false });
  }
  return screens.sort((a, b) => a.section - b.section || compareScreens(a, b));
}
