'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActivityTab, countToday } from '@/components/activity/ActivityTab';
import { markCheckinSent } from '@/components/activity/actions';
import type { CheckinLogRow } from '@/lib/checkins';
import type { NotificationRecord } from '@/lib/notifications';
import { Fade, ScreenStack, type Screen } from '@/components/motion';
import { OnboardingTab } from '@/components/onboarding/OnboardingTab';
import { OverviewTab } from '@/components/overview/OverviewTab';
import { PeopleScreen } from '@/components/people/PeopleScreen';
import { ProfileScreen } from '@/components/profile/ProfileScreen';
import { AppHeader, type HeaderStatItem } from '@/components/shell/AppHeader';
import { NavContext } from '@/components/shell/nav';
import { includedUsers, type Funnel, type Paywall } from '@/lib/funnel';
import { buildOverview } from '@/lib/overview';
import { formatUsd, type RevenueSnapshot } from '@/lib/stripe-revenue';
import type { UserRecord } from '@/lib/types';
import type { UsageSnapshot } from '@/lib/usage';

export default function Dashboard({
  users,
  revenue,
  notifications = [],
  checkinLog = [],
  funnel,
  paywall,
  usage,
}: {
  users: UserRecord[];
  revenue: RevenueSnapshot;
  notifications?: NotificationRecord[];
  checkinLog?: CheckinLogRow[];
  funnel: Funnel;
  paywall: Paywall;
  usage: UsageSnapshot;
}) {
  const [tab, setTab] = useState('overview');
  const [stack, setStack] = useState<Screen[]>([]);
  const [popping, setPopping] = useState(false);
  /** Server log plus sends made this session, so check-in rows disappear and counts drop right away. */
  const [log, setLog] = useState(checkinLog);
  useEffect(() => setLog(checkinLog), [checkinLog]);
  const router = useRouter();
  const onCheckinSent = (user: UserRecord, variation: number) => {
    setLog(l => [{ user_id: user.id, sent_at: new Date().toISOString(), variation }, ...l]);
    markCheckinSent(user.id, variation).then(() => router.refresh()).catch(() => {});
  };

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

  // A push notification tap lands on /?user=<id>: open that profile once, then clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('user');
    if (!userId) return;
    const user = users.find(u => u.id === userId);
    if (user) push({ key: 'profile-' + user.id, node: <ProfileScreen user={user} /> });
    window.history.replaceState(null, '', window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onStat = (s: HeaderStatItem) => push({ key: 'people-' + s.key, node: <PeopleScreen title={s.title} users={s.users} /> });

  const root = (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px calc(var(--safe-bottom) + 64px)', fontFamily: 'var(--font-sans)' }}>
      <AppHeader stats={stats} onStat={onStat} tab={tab} onTab={setTab} badge={countToday(notifications)} />
      <div style={{ paddingTop: 16 }}>
        <Fade id={tab}>
          {tab === 'overview' && <OverviewTab months={overview.months} weeks={overview.weeks} totals={overview.totals} real={real} usage={usage} push={push} />}
          {tab === 'activity' && <ActivityTab users={users} notifications={notifications} checkinLog={log} onSent={onCheckinSent} />}
          {tab === 'onboarding' && <OnboardingTab funnel={funnel} paywall={paywall} users={includedUsers(users)} push={push} />}
        </Fade>
      </div>
    </main>
  );

  return (
    <NavContext.Provider value={{ push, pop, users, checkinLog: log, onCheckinSent }}>
      <ScreenStack screens={[{ key: 'root', node: root }, ...stack]} popping={popping} />
    </NavContext.Provider>
  );
}
