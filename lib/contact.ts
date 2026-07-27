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

export function smsHref(phone: string): string {
  return `sms:${phone}`;
}

export function telHref(phone: string): string {
  return `tel:${phone}`;
}

export function mailtoHref(email: string): string {
  return `mailto:${email}`;
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
