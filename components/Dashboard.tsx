'use client';

import { useMemo, useState } from 'react';
import { addDays, startOfDay } from '@/lib/dates';
import type { UserRecord } from '@/lib/types';
import CalendarView from './CalendarView';
import Funnel from './Funnel';
import TrendChart from './TrendChart';
import UserTable from './UserTable';

type RangeKey = '7d' | '30d' | 'all' | 'custom';

const RANGE_LABEL: Record<RangeKey, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
  custom: 'Custom',
};

export default function Dashboard({ users }: { users: UserRecord[] }) {
  const [range, setRange] = useState<RangeKey>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

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
  const compedCount = users.filter(u => u.status === 'comped').length;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <header className="sticky top-0 z-10 -mx-4 mb-5 border-b border-neutral-200 bg-neutral-50/95 px-4 py-4 backdrop-blur">
        <h1 className="text-xl font-bold">FieldVision Analytics</h1>
        <p className="text-xs text-neutral-500">
          {payingNow} paying · {trialingNow} trialing · {compedCount} comped (excluded from
          revenue)
        </p>
      </header>

      <div className="mb-3 flex rounded-xl bg-neutral-200/60 p-1">
        {(['7d', '30d', 'all', 'custom'] as RangeKey[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setRange(k)}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-colors ${
              range === k ? 'bg-white shadow-sm' : 'text-neutral-500'
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

      <div className="space-y-8">
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

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Signup calendar
          </h2>
          <CalendarView users={realUsers} />
        </section>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            All users
          </h2>
          <UserTable users={users} />
        </section>
      </div>
    </main>
  );
}
