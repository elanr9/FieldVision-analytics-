/**
 * The fake-account rule. Pure: callers pass in the activity facts, this file decides.
 * Accounts already flagged `excludedFromMetrics` (demo, ambassador, admin) never reach this rule.
 */

/** Names that are test accounts on sight, compared lowercase and trimmed. */
const TEST_NAMES = new Set([
  'test',
  'asdf',
  'qwerty',
  'demo',
  'hello',
  'user',
  'tester',
  'tmp',
  'aaa',
  'abc',
  'xyz',
  'delete me',
  'player one',
  'john doe',
  'fake user',
  'test account',
  'coach test',
]);

const TEST_WORD = /\btest\b/;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** How long after a guest signup a matching real signup is still the same session. */
const GUEST_UPGRADE_MS = 30 * 60 * 1000;

export const FAKE_REASONS = {
  testName: 'Test-looking name',
  noLastName: 'No last name, no activity',
  duplicateEmail: 'Duplicate email',
  guestDuplicate: 'Duplicate of a guest signup',
  neverOpened: 'Never opened the app',
} as const;

export type FakeReason = (typeof FAKE_REASONS)[keyof typeof FAKE_REASONS];

export interface FakeCandidate {
  name: string;
  signupDate: string;
  onboarding: 'none' | 'in_progress' | 'completed';
  /** Rows in product_events for this account */
  eventCount: number;
  /** Another account shares the normalised email and signed up earlier */
  laterDuplicateEmail: boolean;
  /** This account is the signed-in half of an earlier guest signup, which is kept instead */
  guestDuplicate: boolean;
}

export interface FakeVerdict {
  fake: boolean;
  reason?: FakeReason;
}

/** First matching rule wins. */
export function isLikelyFake(u: FakeCandidate, now: Date = new Date()): FakeVerdict {
  const name = u.name.trim().toLowerCase();
  if (TEST_NAMES.has(name) || TEST_WORD.test(name)) {
    return { fake: true, reason: FAKE_REASONS.testName };
  }
  const singleWord = name.length > 0 && !/\s/.test(name);
  if (singleWord && u.eventCount === 0 && u.onboarding !== 'completed') {
    return { fake: true, reason: FAKE_REASONS.noLastName };
  }
  if (u.laterDuplicateEmail) {
    return { fake: true, reason: FAKE_REASONS.duplicateEmail };
  }
  if (u.guestDuplicate) {
    return { fake: true, reason: FAKE_REASONS.guestDuplicate };
  }
  const ageMs = now.getTime() - new Date(u.signupDate).getTime();
  if (u.eventCount === 0 && u.onboarding === 'none' && ageMs >= WEEK_MS) {
    return { fake: true, reason: FAKE_REASONS.neverOpened };
  }
  return { fake: false };
}

/** Lowercase everywhere; gmail addresses also lose dots and any +tag in the local part. */
export function normalizeEmail(email: string): string {
  const lower = email.trim().toLowerCase();
  const at = lower.lastIndexOf('@');
  if (at < 0) return lower;
  let local = lower.slice(0, at);
  const domain = lower.slice(at + 1);
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    local = local.split('+')[0].replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

export interface LinkableAccount {
  id: string;
  name: string;
  email: string;
  signupDate: string;
}

/** The later account a guest signup turned into, once the person signed in for real. */
export interface GuestUpgrade {
  laterId: string;
  email: string;
  name: string;
}

/** True when the shorter name is the leading words of the longer one: "Jaylen" and "Jaylen Mack". */
function sameNameStart(a: string, b: string): boolean {
  const x = a.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const y = b.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (x.length === 0 || y.length === 0) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((word, i) => word === long[i]);
}

/**
 * Guest (emailless) signups matched to the account the same person created minutes later with a real
 * email, keyed by the guest id. The guest record survives: it holds the true signup date, the
 * onboarding progress, the product events and the subscription.
 */
export function guestUpgrades(accounts: LinkableAccount[]): Map<string, GuestUpgrade> {
  const named = accounts.filter(a => a.email.trim() !== '');
  const upgrades = new Map<string, GuestUpgrade>();
  for (const guest of accounts) {
    if (guest.email.trim() !== '') continue;
    const guestAt = new Date(guest.signupDate).getTime();
    let best: LinkableAccount | undefined;
    for (const a of named) {
      const gap = new Date(a.signupDate).getTime() - guestAt;
      if (gap <= 0 || gap > GUEST_UPGRADE_MS) continue;
      if (!sameNameStart(a.name, guest.name)) continue;
      if (!best || new Date(a.signupDate).getTime() < new Date(best.signupDate).getTime()) best = a;
    }
    if (best) upgrades.set(guest.id, { laterId: best.id, email: best.email, name: best.name });
  }
  return upgrades;
}

/** Ids of accounts whose normalised email was already used by an earlier signup. Empty emails never match. */
export function laterDuplicateEmailIds(
  accounts: { id: string; email: string; signupDate: string }[],
): Set<string> {
  const earliest = new Map<string, number>();
  for (const a of accounts) {
    const key = normalizeEmail(a.email);
    if (!key) continue;
    const at = new Date(a.signupDate).getTime();
    const seen = earliest.get(key);
    if (seen === undefined || at < seen) earliest.set(key, at);
  }
  const later = new Set<string>();
  for (const a of accounts) {
    const key = normalizeEmail(a.email);
    if (!key) continue;
    const first = earliest.get(key);
    if (first !== undefined && new Date(a.signupDate).getTime() > first) later.add(a.id);
  }
  return later;
}
