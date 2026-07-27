'use client';

import { useMemo, useState } from 'react';
import { addDays, startOfDay } from '@/lib/dates';
import { formatUsd, type RevenueSnapshot } from '@/lib/stripe-revenue';
import type { UserRecord } from '@/lib/types';
import CalendarView from './CalendarView';
import Funnel from './Funnel';
import Pipeline from './Pipeline';
import RevenueSection from './RevenueSection';
import TrendChart from './TrendChart';
import UserDetail from './UserDetail';
import UserTable from './UserTable';

type RangeKey = '7d' | '30d' | 'all' | 'custom';
type Tab = 'overview' | 'pipeline' | 'users' | 'calendar';

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
  custom: 'Custom',
};

const TAB_LABEL: Record<Tab, string> = {
  overview: 'Overview',
  pipeline: 'Follow ups',
  users: 'Users',
  calendar: 'Calendar',
};

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
  const [selected, setSelected] = useState<UserRecord | null>(null);

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

  const payingNow = realUsers.filter(u => u.status === 'paying').length;
  const trialingNow = realUsers.filter(u => u.status === 'trialing').length;
  const followUps = realUsers.filter(u => u.pipeline !== null).length;

  const headerStats: { label: string; value: string; accent?: boolean }[] = [
    { label: 'Paying', value: String(payingNow), accent: true },
    ...(revenue.configured ? [{ label: 'MRR', value: formatUsd(revenue.mrrCents) }] : []),
    { label: 'Trialing', value: String(trialingNow) },
    { label: 'Follow ups', value: String(followUps) },
  ];

  const showRangePicker = tab === 'overview';

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-20 -mx-4 border-b border-neutral-200 bg-neutral-50/95 px-4 pt-4 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <h1 className="shrink-0 text-lg font-bold sm:text-xl">FieldVision</h1>
          <div className="no-scrollbar flex items-center gap-4 overflow-x-auto">
            {headerStats.map(s => (
              <div key={s.label} className="shrink-0 text-right">
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
              </div>
            ))}
          </div>
        </div>

        <nav className="no-scrollbar mt-2.5 flex gap-1 overflow-x-auto pb-2">
          {(Object.keys(TAB_LABEL) as Tab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors active:scale-95 ${
                tab === t
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:bg-neutral-200/60 active:bg-neutral-200'
              }`}
            >
              {TAB_LABEL[t]}
              {t === 'pipeline' && followUps > 0 && (
                <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white">
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
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
                <span className="text-sm text-neutral-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
                />
              </div>
            )}
          </>
        )}

        {tab === 'overview' && (
          <div className="space-y-8">
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Revenue · {RANGE_LABEL[range]}
              </h2>
              <RevenueSection revenue={revenue} from={from} to={to} rangeLabel={RANGE_LABEL[range]} />
            </section>
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Funnel · {RANGE_LABEL[range]}
              </h2>
              <Funnel cohort={cohort} />
            </section>
            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                Trend
              </h2>
              <TrendChart users={realUsers} from={from} to={to} />
            </section>
          </div>
        )}

        {tab === 'pipeline' && <Pipeline users={realUsers} onSelect={setSelected} />}

        {tab === 'users' && <UserTable users={users} onSelect={setSelected} />}

        {tab === 'calendar' && <CalendarView users={realUsers} onSelect={setSelected} />}
      </div>

      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
