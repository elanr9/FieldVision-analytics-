'use client';

import { useMemo, useState } from 'react';
import { ActivityTab, countToday } from '@/components/activity/ActivityTab';
import type { CheckinLogRow } from '@/lib/checkins';
import type { NotificationRecord } from '@/lib/notifications';
import { Fade, ScreenStack, type Screen } from '@/components/motion';
import { OverviewTab } from '@/components/overview/OverviewTab';
import { PeopleScreen } from '@/components/people/PeopleScreen';
import { AppHeader, type HeaderStatItem } from '@/components/shell/AppHeader';
import { NavContext } from '@/components/shell/nav';
import { buildOverview } from '@/lib/overview';
import { formatUsd, type RevenueSnapshot } from '@/lib/stripe-revenue';
import type { UserRecord } from '@/lib/types';

export default function Dashboard({
  users,
  revenue,
  notifications = [],
  checkinLog = [],
}: {
  users: UserRecord[];
  revenue: RevenueSnapshot;
  notifications?: NotificationRecord[];
  checkinLog?: CheckinLogRow[];
}) {
  const [tab, setTab] = useState('overview');
  const [stack, setStack] = useState<Screen[]>([]);
  const [popping, setPopping] = useState(false);

  const overview = useMemo(() => buildOverview(users, revenue), [users, revenue]);
  const real = users.filter(u => !u.excludedFromMetrics);
  const everyone = real;
  const paying = everyone.filter(u => u.status === 'paying');
  const trialing = everyone.filter(u => u.status === 'trialing');

  const stats: HeaderStatItem[] = [
    { key: 'users', label: 'Users', value: everyone.length, title: 'All accounts', users: everyone },
    { key: 'paying', label: 'Paying', value: paying.length, accent: true, title: 'Paying', users: paying },
    { key: 'mrr', label: 'MRR', value: formatUsd(revenue.mrrCents), title: 'Paying', users: paying },
    { key: 'trialing', label: 'Trialing', value: trialing.length, title: 'Trialing', users: trialing },
  ];

  const push = (s: Screen) => {
    setPopping(false);
    setStack(st => [...st, { ...s, key: s.key + '-' + Date.now() }]);
    window.scrollTo(0, 0);
  };
  const pop = () => {
    setPopping(true);
    setTimeout(() => {
      setStack(st => st.slice(0, -1));
      setPopping(false);
    }, 300);
  };

  const onStat = (s: HeaderStatItem) => push({ key: 'people-' + s.key, node: <PeopleScreen title={s.title} users={s.users} /> });

  const root = (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px calc(var(--safe-bottom) + 64px)', fontFamily: 'var(--font-sans)' }}>
      <AppHeader stats={stats} onStat={onStat} tab={tab} onTab={setTab} badge={countToday(notifications)} />
      <div style={{ paddingTop: 16 }}>
        <Fade id={tab}>
          {tab === 'activity' && <ActivityTab users={users} notifications={notifications} checkinLog={checkinLog} />}
          {tab === 'overview' && <OverviewTab months={overview.months} weeks={overview.weeks} totals={overview.totals} real={real} push={push} />}
        </Fade>
      </div>
    </main>
  );

  return (
    <NavContext.Provider value={{ push, pop, users }}>
      <ScreenStack screens={[{ key: 'root', node: root }, ...stack]} popping={popping} />
    </NavContext.Provider>
  );
}
