'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  aggregateRevenueInRange,
  formatUsd,
  type RevenueSnapshot,
} from '@/lib/stripe-revenue';

export default function RevenueSection({
  revenue,
  from,
  to,
  rangeLabel,
  selectedKey,
  onPick,
}: {
  revenue: RevenueSnapshot;
  from: Date;
  to: Date;
  rangeLabel: string;
  selectedKey: string;
  onPick: (key: string) => void;
}) {
  const { totalCents, byDay } = useMemo(
    () => aggregateRevenueInRange(revenue.events, from, to),
    [revenue.events, from, to],
  );

  if (!revenue.configured) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Revenue from Stripe is off until you add{' '}
        <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code> in Vercel (same
        secret key as Supabase edge functions), then redeploy.
      </div>
    );
  }

  if (revenue.error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-semibold text-red-800">Stripe returned an error</p>
        <p className="mt-1 break-words text-sm text-red-700">{revenue.error}</p>
        <p className="mt-2 text-xs text-red-600">
          Most common cause: STRIPE_SECRET_KEY is the publishable key (pk_live) instead of the
          secret key (sk_live), or the key was pasted with extra characters.
        </p>
      </div>
    );
  }

  const chartData = byDay.map(d => ({
    ...d,
    dollars: Math.round(d.cents / 100),
  }));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onPick('rev-gross')}
          className={`rounded-2xl border bg-white p-3 text-left sm:p-4 ${
            selectedKey === 'rev-gross' ? 'border-neutral-900' : 'border-neutral-200'
          }`}
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-[11px]">
            Gross · {rangeLabel}
          </p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums text-emerald-600 sm:text-3xl">
            {formatUsd(totalCents)}
          </p>
          <p className="mt-1 text-[10px] text-neutral-500 sm:text-xs">
            Succeeded payments, $0 excluded
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPick('rev-mrr')}
          className={`rounded-2xl border bg-white p-3 text-left sm:p-4 ${
            selectedKey === 'rev-mrr' ? 'border-neutral-900' : 'border-neutral-200'
          }`}
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-[11px]">
            MRR
          </p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums sm:text-3xl">
            {formatUsd(revenue.mrrCents)}
          </p>
          <p className="mt-1 text-[10px] text-neutral-500 sm:text-xs">
            ARR {formatUsd(revenue.mrrCents * 12)} · {revenue.activeSubscriptionCount} subs
          </p>
        </button>
        <button
          type="button"
          onClick={() => onPick('rev-all')}
          className={`rounded-2xl border bg-white p-3 text-left sm:p-4 ${
            selectedKey === 'rev-all' ? 'border-neutral-900' : 'border-neutral-200'
          }`}
        >
          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-[11px]">
            All time
          </p>
          <p className="mt-1 truncate text-xl font-bold tabular-nums sm:text-3xl">
            {formatUsd(revenue.events.reduce((s, e) => s + e.cents, 0))}
          </p>
          <p className="mt-1 text-[10px] text-neutral-500 sm:text-xs">
            {revenue.events.length} succeeded payments
          </p>
        </button>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold text-neutral-500">Revenue by day</p>
        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm text-neutral-500">No payments in this range.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={20} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(value) => {
                    const n = typeof value === 'number' ? value : Number(value);
                    return [formatUsd(Number.isFinite(n) ? n * 100 : 0), 'Revenue'];
                  }}
                  labelStyle={{ fontSize: 12, fontWeight: 600 }}
                  contentStyle={{ fontSize: 12, borderRadius: 12 }}
                />
                <Bar dataKey="dollars" name="Revenue" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
