'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, startOfDay } from '@/lib/dates';
import { formatUsd, type RevenueEvent, type RevenueSnapshot } from '@/lib/stripe-revenue';
import type { UserRecord } from '@/lib/types';
import CalendarView from './CalendarView';
import Funnel from './Funnel';
import OnboardingAnalytics from './OnboardingAnalytics';
import Pipeline from './Pipeline';
import RevenueSection from './RevenueSection';
import TrendChart from './TrendChart';
import UserTable, { UserList } from './UserTable';

type RangeKey = '7d' | '30d' | 'all' | 'custom';
type Tab = 'overview' | 'onboarding' | 'pipeline' | 'users' | 'calendar';

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
  custom: 'Custom',
};

const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  onboarding: 'Onboarding',
  pipeline: 'Follow ups',
  users: 'Users',
  calendar: 'Calendar',
};

function usersFromEvents(
  users: UserRecord[],
  events: RevenueEvent[],
  from?: Date,
  to?: Date,
): UserRecord[] {
  const fromMs = from?.getTime();
  const toMs = to?.getTime();
  const ids = new Set<string>();
  for (const event of events) {
    if (!event.userId) continue;
    const t = new Date(event.paidAt).getTime();
    if (fromMs != null && t < fromMs) continue;
    if (toMs != null && t > toMs) continue;
    ids.add(event.userId);
  }
  return users.filter(u => ids.has(u.id));
}

export default function Dashboard({
  users,
  revenue,
}: {
  users: UserRecord[];
  revenue: RevenueSnapshot;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const [range, setRange] = useState<RangeKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [people, setPeople] = useState<{ key: string; title: string; users: UserRecord[] } | null>(
    null,
  );

  /** Real users only. Demo, ambassador, and admin accounts never enter metrics. */
  const realUsers = useMemo(() => users.filter(u => !u.excludedFromMetrics), [users]);

  const { from, to } = useMemo(() => {
    const now = new Date();
    if (range === '7d') return { from: startOfDay(addDays(now, -6)), to: now };
    if (range === '30d') return { from: startOfDay(addDays(now, -29)), to: now };
    if (range === 'custom' && customFrom && customTo) {
      return {
        from: startOfDay(new Date(`${customFrom}T00:00:00`)),
        to: new Date(`${customTo}T23:59:59`),
      };
    }
    const earliest = realUsers.reduce(
      (min, u) => Math.min(min, new Date(u.signupDate).getTime()),
      now.getTime(),
    );
    return { from: startOfDay(new Date(earliest)), to: now };
  }, [range, customFrom, customTo, realUsers]);

  const cohort = useMemo(
    () =>
      realUsers.filter(u => {
        const t = new Date(u.signupDate).getTime();
        return t >= from.getTime() && t <= to.getTime();
      }),
    [realUsers, from, to],
  );

  const payingUsers = useMemo(
    () => realUsers.filter(u => u.status === 'paying'),
    [realUsers],
  );
  const trialingUsers = useMemo(
    () => realUsers.filter(u => u.status === 'trialing'),
    [realUsers],
  );
  const followUpUsers = useMemo(
    () => realUsers.filter(u => u.pipeline !== null),
    [realUsers],
  );
  const payingNow = payingUsers.length;
  const trialingNow = trialingUsers.length;
  const followUps = followUpUsers.length;

  useEffect(() => {
    setPeople(null);
  }, [range, customFrom, customTo]);

  function openPeople(key: string, title: string, list: UserRecord[]) {
    setPeople({ key, title, users: list });
    if (tab !== 'overview' && tab !== 'onboarding') setTab('overview');
  }

  const visiblePeople = people ?? {
    key: 'funnel-signed-up',
    title: 'Signed up',
    users: cohort,
  };

  const headerStats: {
    key: string;
    label: string;
    value: string;
    accent?: boolean;
    title: string;
    users: UserRecord[];
  }[] = [
    {
      key: 'paying',
      label: 'Paying',
      value: String(payingNow),
      accent: true,
      title: 'Paying',
      users: payingUsers,
    },
    ...(revenue.configured
      ? [
          {
            key: 'rev-mrr',
            label: 'MRR',
            value: formatUsd(revenue.mrrCents),
            title: 'Paying',
            users: payingUsers,
          },
        ]
      : []),
    {
      key: 'trialing',
      label: 'Trialing',
      value: String(trialingNow),
      title: 'Trialing',
      users: trialingUsers,
    },
    {
      key: 'follow-ups',
      label: 'Follow ups',
      value: String(followUps),
      title: 'Follow ups',
      users: followUpUsers,
    },
  ];

  const showRangePicker = tab === 'overview' || tab === 'onboarding';

  return (
    <main className="mx-auto max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
      <header className="sticky top-0 z-20 -mx-4 border-b border-neutral-200 bg-neutral-50 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="shrink-0 text-lg font-bold sm:text-xl">FieldVision</h1>
          <div className="no-scrollbar flex items-center gap-4 overflow-x-auto">
            {headerStats.map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => openPeople(s.key, s.title, s.users)}
                className={`shrink-0 text-right ${
                  visiblePeople.key === s.key ? 'opacity-100' : 'opacity-80'
                }`}
              >
                <p
                  className={`text-sm font-bold tabular-nums leading-tight ${
                    s.accent ? 'text-emerald-600' : ''
                  }`}
                >
                  {s.value}
                </p>
                <p className="whitespace-nowrap text-[10px] uppercase tracking-wide text-neutral-400">
                  {s.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        <nav className="mt-2.5 flex gap-1 pb-2">
          {(Object.keys(TAB_LABEL) as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`relative min-h-11 flex-1 whitespace-nowrap rounded-full px-1 py-2 text-[13px] font-semibold transition-colors ${
                tab === t
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:bg-neutral-200/60 active:bg-neutral-200'
              }`}
            >
              {TAB_LABEL[t]}
              {t === 'pipeline' && followUps > 0 && (
                <span className="absolute -top-1 right-0 rounded-full bg-emerald-500 px-1.5 py-px text-[10px] font-bold text-white">
                  {followUps}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="pt-4">
        {showRangePicker && (
          <>
            <div className="mb-3 flex rounded-xl bg-neutral-200/60 p-1">
              {(['7d', '30d', 'all', 'custom'] as RangeKey[]).map(k => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setRange(k)}
                  className={`min-h-10 flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
                    range === k ? 'bg-white shadow-sm' : 'text-neutral-500 active:bg-neutral-100'
                  }`}
                >
                  {RANGE_LABEL[k]}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="mb-3 flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base"
                />
                <span className="text-sm text-neutral-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-base"
                />
              </div>
            )}
          </>
        )}

        {tab === 'overview' && (
          <div className="space-y-8">
            <UserList title={visiblePeople.title} users={visiblePeople.users} />
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Revenue · {RANGE_LABEL[range]}
              </h2>
              <RevenueSection
                revenue={revenue}
                from={from}
                to={to}
                rangeLabel={RANGE_LABEL[range]}
                selectedKey={visiblePeople.key}
                onPick={key => {
                  if (key === 'rev-mrr') {
                    openPeople(key, 'Paying', payingUsers);
                    return;
                  }
                  if (key === 'rev-gross') {
                    openPeople(
                      key,
                      'Paid this period',
                      usersFromEvents(realUsers, revenue.events, from, to),
                    );
                    return;
                  }
                  openPeople(key, 'Paid all time', usersFromEvents(realUsers, revenue.events));
                }}
              />
            </section>
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Funnel · {RANGE_LABEL[range]}
              </h2>
              <Funnel
                cohort={cohort}
                selectedKey={visiblePeople.key}
                onPick={(key, title, list) => openPeople(key, title, list)}
              />
            </section>
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Trend
              </h2>
              <TrendChart users={realUsers} from={from} to={to} />
            </section>
          </div>
        )}

        {tab === 'onboarding' && (
          <div className="space-y-8">
            {people && <UserList title={people.title} users={people.users} />}
            <OnboardingAnalytics
              cohort={cohort}
              rangeLabel={RANGE_LABEL[range]}
              from={from}
              to={to}
              selectedKey={visiblePeople.key}
              onPick={(key, title, list) => openPeople(key, title, list)}
            />
          </div>
        )}

        {tab === 'pipeline' && <Pipeline users={realUsers} />}

        {tab === 'users' && <UserTable users={users} />}

        {tab === 'calendar' && <CalendarView users={realUsers} />}
      </div>
    </main>
  );
}
