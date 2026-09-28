import { formatUsd } from '@/lib/stripe-revenue';

export function pct(n: number | null): string {
  return n === null ? '—' : n + '%';
}

export function money(cents: number): string {
  return formatUsd(cents);
}

export function monthly(cents: number): string {
  return formatUsd(cents) + '/mo';
}

export function people(n: number): string {
  return n === 1 ? '1 person' : n + ' people';
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function days(n: number): string {
  if (n < 1) return 'under a day';
  const whole = Math.round(n);
  return whole === 1 ? '1 day' : whole + ' days';
}
