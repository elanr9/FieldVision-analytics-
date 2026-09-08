'use client';

import { NOTIF_DOT, type NotificationRecord } from '@/lib/notifications';

/** "38m ago" under an hour, "5h ago" under a day, else "3d ago". */
export function timeAgo(minutes: number): string {
  if (minutes < 60) return minutes + 'm ago';
  if (minutes < 60 * 24) return Math.round(minutes / 60) + 'h ago';
  return Math.round(minutes / 60 / 24) + 'd ago';
}

export function minutesAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export interface NotifRowProps {
  n: NotificationRecord;
  now: number;
  onOpen: () => void;
}

export function NotifRow({ n, now, onOpen }: NotifRowProps) {
  return (
    <button type="button" onClick={onOpen} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto', alignItems: 'start', gap: 10, width: '100%', padding: '9px 14px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: NOTIF_DOT[n.type], marginTop: 5 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', font: '500 13px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
        <span style={{ display: 'block', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[n.userName, n.sub].filter(Boolean).join(' · ')}</span>
      </span>
      <span style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginTop: 2 }}>{timeAgo(minutesAgo(n.createdAt, now))}</span>
    </button>
  );
}
