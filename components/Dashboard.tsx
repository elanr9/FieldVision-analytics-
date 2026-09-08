'use client';

import { useState } from 'react';
import { Fade, ScreenStack, type Screen } from '@/components/motion';
import { AppHeader, type HeaderStatItem } from '@/components/shell/AppHeader';
import { NavContext } from '@/components/shell/nav';
import { formatUsd, type RevenueSnapshot } from '@/lib/stripe-revenue';
import type { UserRecord } from '@/lib/types';

export default function Dashboard({
  users,
  revenue,
}: {
  users: UserRecord[];
  revenue: RevenueSnapshot;
}) {
  const [stack, setStack] = useState<Screen[]>([]);
  const [popping, setPopping] = useState(false);

  const everyone = users.filter(u => !u.excludedFromMetrics);
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

  const onStat = (_stat: HeaderStatItem) => {
    // TODO(handoff-1 step 7): push PeopleScreen
  };

  const root = (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px calc(var(--safe-bottom) + 64px)', fontFamily: 'var(--font-sans)' }}>
      <AppHeader stats={stats} onStat={onStat} tab="overview" onTab={() => {}} />
      <div style={{ paddingTop: 16 }}>
        <Fade id="overview">
          {/* TODO(handoff-1 step 6): <OverviewTab /> */}
          {null}
        </Fade>
      </div>
    </main>
  );

  return (
    <NavContext.Provider value={{ push, pop }}>
      <ScreenStack screens={[{ key: 'root', node: root }, ...stack]} popping={popping} />
    </NavContext.Provider>
  );
}
