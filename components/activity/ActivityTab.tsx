'use client';

import { useState } from 'react';
import { Fade, usePager } from '@/components/motion';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { useNav, type NavContextValue } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { checkinsDue, lastSentAt, type CheckinLogRow } from '@/lib/checkins';
import type { NotificationRecord, NotificationType } from '@/lib/notifications';
import type { UserRecord } from '@/lib/types';
import { CheckinRow } from './CheckinRow';
import { NotifRow, minutesAgo } from './NotifRow';

type View = 'feed' | 'checkins';
type DayKey = 'today' | 'yesterday' | 'earlier';
type KindKey = 'all' | 'money' | 'paywall' | 'coaches';

const NOTIF_GROUPS: Record<KindKey, NotificationType[] | null> = {
  all: null,
  money: ['paid', 'trial', 'cancel', 'save'],
  paywall: ['paywall', 'wheel', 'stalled'],
  coaches: ['reply', 'campaign', 'video', 'call'],
};

const DAY: Record<DayKey, (minsAgo: number) => boolean> = {
  today: m => m < 60 * 24,
  yesterday: m => m >= 60 * 24 && m < 60 * 48,
  earlier: m => m >= 60 * 48,
};

/** Events in the last 24 hours, used for the Activity tab badge. */
export function countToday(notifications: NotificationRecord[], now: number = Date.now()): number {
  return notifications.filter(n => DAY.today(minutesAgo(n.createdAt, now))).length;
}

/** Profile push lands in handoff 2 as `open` on the nav context; until then this is a no-op. */
type NavWithOpen = NavContextValue & { open?: (user: UserRecord) => void };

const EMPTY_STYLE = { margin: 0, padding: '24px 16px', textAlign: 'center', font: '400 14px var(--font-sans)', color: 'var(--text-secondary)' } as const;

export interface ActivityTabProps {
  users: UserRecord[];
  notifications: NotificationRecord[];
  checkinLog: CheckinLogRow[];
}

export function ActivityTab({ users, notifications, checkinLog }: ActivityTabProps) {
  const [view, setView] = useState<View>('feed');
  const [kind, setKind] = useState<KindKey>('all');
  const [dayK, setDayK] = useState<DayKey>('today');
  const [now] = useState(() => Date.now());
  const nav = useNav() as NavWithOpen;

  const byId = new Map(users.map(u => [u.id, u]));
  const openProfile = (userId: string) => {
    const user = byId.get(userId);
    if (user) nav.open?.(user);
  };

  const due = checkinsDue(users, checkinLog, new Date(now));
  const list = notifications.filter(n => DAY[dayK](minutesAgo(n.createdAt, now)) && (!NOTIF_GROUPS[kind] || NOTIF_GROUPS[kind].includes(n.type)));
  const pager = usePager(list, 7);
  const duePager = usePager(due, 6);

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <SegmentedControl value={view} onChange={k => setView(k as View)} options={[{ key: 'feed', label: 'Feed' }, { key: 'checkins', label: due.length ? 'Check-ins · ' + due.length : 'Check-ins' }]} />
      <Fade id={view + kind}>
        {view === 'checkins' && <div>
          <Card padding="none">
            {due.length === 0 ? <p style={EMPTY_STYLE}>Everyone&apos;s been checked in on this week.</p> :
              duePager.slice.map((u, i) => <div key={u.id} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}><CheckinRow u={u} lastCheckin={lastSentAt(u.id, checkinLog)} now={now} onOpen={() => openProfile(u.id)} onText={() => { /* TODO(step 5): open CheckinSheet */ }} /></div>)}
            {duePager.footer}
          </Card>
          <p style={{ margin: '8px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>Paying and trialing users get a check-in text from Elan once a week. Stops when they churn.</p>
        </div>}
        {view === 'feed' && <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <MiniToggle<DayKey> value={dayK} onChange={setDayK} options={[['today', 'Today'], ['yesterday', 'Yesterday'], ['earlier', 'Earlier']]} />
            <MiniToggle<KindKey> value={kind} onChange={setKind} options={[['all', 'All'], ['money', '$'], ['paywall', 'Paywall'], ['coaches', 'Coaches']]} />
          </div>
          <Card padding="none">
            {pager.slice.length === 0 ? <p style={EMPTY_STYLE}>Nothing here.</p> :
              pager.slice.map((n, i) => <div key={n.id} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}><NotifRow n={n} now={now} onOpen={() => openProfile(n.userId)} /></div>)}
            {pager.footer}
          </Card>
        </div>}
      </Fade>
    </div>
  );
}
