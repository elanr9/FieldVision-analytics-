'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { addDays, dayKey, startOfDay } from '@/lib/dates';
import type { UserRecord } from '@/lib/types';

interface Point {
  day: string;
  label: string;
  signups: number;
  trials: number;
  conversions: number;
}

/**
 * Daily counts of signups, trial starts, and real paid conversions between
 * from and to. Only real users are passed in; comped and demo never appear.
 */
export default function TrendChart({
  users,
  from,
  to,
}: {
  users: UserRecord[];
  from: Date;
  to: Date;
}) {
  const byDay = new Map<string, Point>();
  for (let d = startOfDay(from); d.getTime() <= to.getTime(); d = addDays(d, 1)) {
    const key = dayKey(d);
    byDay.set(key, {
      day: key,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      signups: 0,
      trials: 0,
      conversions: 0,
    });
  }

  for (const u of users) {
    const signup = byDay.get(dayKey(new Date(u.signupDate)));
    if (signup) signup.signups++;
    if (u.trialStartedAt) {
      const trial = byDay.get(dayKey(new Date(u.trialStartedAt)));
      if (trial) trial.trials++;
    }
    if (u.status === 'paying' && u.paidAt) {
      const paid = byDay.get(dayKey(new Date(u.paidAt)));
      if (paid) paid.conversions++;
    }
  }

  const data = [...byDay.values()];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              labelStyle={{ fontSize: 12, fontWeight: 600 }}
              contentStyle={{ fontSize: 12, borderRadius: 12 }}
            />
            <Line type="monotone" dataKey="signups" name="Signups" stroke="#a3a3a3" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="trials" name="Trial starts" stroke="#0ea5e9" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="conversions" name="Paid conversions" stroke="#059669" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-neutral-600">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-neutral-400" /> Signups</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Trial starts</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" /> Paid conversions</span>
      </div>
    </div>
  );
}
