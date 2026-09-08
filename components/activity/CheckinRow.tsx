'use client';

import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { planLabel } from '@/lib/profile';
import type { UserRecord } from '@/lib/types';
import { timeAgo, minutesAgo } from './NotifRow';

export interface CheckinRowProps {
  u: UserRecord;
  /** ISO timestamp of the last check-in, null when never texted. */
  lastCheckin: string | null;
  now: number;
  onText: () => void;
  onOpen: () => void;
}

export function CheckinRow({ u, lastCheckin, now, onText, onOpen }: CheckinRowProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <button type="button" onClick={onOpen} style={{ flex: 1, minWidth: 0, background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
        <p style={{ margin: 0, font: '500 14px/1.5 var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8 }}>{u.name} <StatusBadge status={u.status} /></p>
        <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{planLabel(u.paymentType, u.interval)} · {lastCheckin === null ? 'Never checked in' : 'Last check-in ' + timeAgo(minutesAgo(lastCheckin, now))}</p>
      </button>
      <Button size="sm" variant="money" onClick={onText}>Text</Button>
    </div>
  );
}
