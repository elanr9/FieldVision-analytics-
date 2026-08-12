/** Normalizes a phone number for tel: and sms: links. Returns null if unusable. */
export function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  const bare = digits.replace(/\+/g, '');
  if (bare.length < 10) return null;
  if (digits.startsWith('+')) return `+${bare}`;
  if (bare.length === 10) return `+1${bare}`;
  return `+${bare}`;
}

/** First name for outreach copy. Falls back to "there" if name is empty. */
export function firstName(fullName: string | null | undefined): string {
  const part = fullName?.trim().split(/\s+/)[0];
  return part || 'there';
}

/** Prefills iMessage/SMS with the outreach template for this user. */
export function outreachSmsBody(
  name: string,
  onTrial: boolean,
  cancelled = false,
): string {
  const first = firstName(name);
  if (cancelled) {
    return `Hey ${first}, I saw that you just cancelled your account, I wanted to ask what the reason was and also check in and see if I could have any advice for you on your college recruitment`;
  }
  if (onTrial) {
    return `Hey ${first}, I'm Elan, the CEO of FieldVision! Saw you made an account and are on a free trial, wanted to check in and see how's everything going. If you have any questions about FieldVision or college recruitment in general feel free to call or text me whenever!`;
  }
  return `Hey ${first}, I'm Elan, the CEO of FieldVision AI. I saw you made an account and just wanted to reach out to see if you have any questions about FieldVision or college recruitment in general, whether you use FieldVision or not I'm always here for any questions so feel free to call or text anytime!`;
}

/** Same outreach as SMS, formatted as a clean email with signature. */
export function outreachEmailBody(
  name: string,
  onTrial: boolean,
  cancelled = false,
): string {
  const first = firstName(name);
  const sms = outreachSmsBody(name, onTrial, cancelled);
  const body = sms.replace(`Hey ${first}, `, `Hey ${first},\n\n`);
  return `${body}\n\nBest,\nElan\nCEO & Co-founder, FieldVision`;
}

export const OUTREACH_EMAIL_SUBJECT = 'Quick check-in from FieldVision';

export function smsHref(phone: string, body?: string): string {
  if (!body) return `sms:${phone}`;
  // iOS uses &body=, Android uses ?body=
  const isIos =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const sep = isIos ? '&' : '?';
  return `sms:${phone}${sep}body=${encodeURIComponent(body)}`;
}

export function telHref(phone: string): string {
  return `tel:${phone}`;
}

/** Opens the Gmail app compose screen (iOS/Android). Avoids Safari mailto. */
export function gmailComposeHref(
  email: string,
  opts?: { subject?: string; body?: string },
): string {
  // URLSearchParams encodes spaces as "+", which the Gmail app renders
  // literally. Use encodeURIComponent so spaces become %20.
  const parts = [`to=${encodeURIComponent(email)}`];
  if (opts?.subject) parts.push(`subject=${encodeURIComponent(opts.subject)}`);
  if (opts?.body) parts.push(`body=${encodeURIComponent(opts.body)}`);
  return `googlegmail://co?${parts.join('&')}`;
}

export function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export function hoursUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 3600000);
}
