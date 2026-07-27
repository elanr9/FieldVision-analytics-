'use client';

import { useMemo, useState } from 'react';
import { dayKey } from '@/lib/dates';
import type { UserRecord } from '@/lib/types';
import StatusBadge from './StatusBadge';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Month calendar of real signups. Clicking a day lists who signed up. */
export default function CalendarView({
  users,
  onSelect,
}: {
  users: UserRecord[];
  onSelect: (u: UserRecord) => void;
}) {
  const [monthStart, setMonthStart] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const signupsByDay = useMemo(() => {
    const map = new Map<string, UserRecord[]>();
    for (const u of users) {
      const key = dayKey(new Date(u.signupDate));
      const list = map.get(key) ?? [];
      list.push(u);
      map.set(key, list);
    }
    return map;
  }, [users]);

  const cells = useMemo(() => {
    const firstWeekday = monthStart.getDay();
    const daysInMonth = new Date(
      monthStart.getFullYear(),
      monthStart.getMonth() + 1,
      0,
    ).getDate();
    const result: ({ key: string; date: number } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push({
        key: dayKey(new Date(monthStart.getFullYear(), monthStart.getMonth(), d)),
        date: d,
      });
    }
    return result;
  }, [monthStart]);

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const todayKey = dayKey(new Date());
  const selectedUsers = selectedDay ? signupsByDay.get(selectedDay) ?? [] : [];

  const shiftMonth = (delta: number) => {
    setSelectedDay(null);
    setMonthStart(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
        >
          ←
        </button>
        <p className="text-sm font-bold">{monthLabel}</p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100"
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map(w => (
          <p key={w} className="pb-1 text-[10px] font-semibold uppercase text-neutral-400">
            {w}
          </p>
        ))}
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`empty-${i}`} />
          ) : (
            <button
              key={cell.key}
              type="button"
              onClick={() => setSelectedDay(cell.key === selectedDay ? null : cell.key)}
              className={`flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition-colors ${
                selectedDay === cell.key
                  ? 'bg-emerald-600 text-white'
                  : cell.key === todayKey
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'hover:bg-neutral-100'
              }`}
            >
              <span className="font-medium">{cell.date}</span>
              {(signupsByDay.get(cell.key)?.length ?? 0) > 0 && (
                <span
                  className={`mt-0.5 rounded-full px-1.5 text-[10px] font-bold ${
                    selectedDay === cell.key
                      ? 'bg-white/25 text-white'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {signupsByDay.get(cell.key)?.length}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {selectedDay && (
        <div className="mt-4 rounded-xl border border-neutral-200">
          <p className="border-b border-neutral-200 px-4 py-2.5 text-xs font-semibold text-neutral-500">
            Signups on{' '}
            {new Date(`${selectedDay}T12:00:00`).toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {selectedUsers.length === 0 ? (
            <p className="px-4 py-4 text-sm text-neutral-500">No signups this day.</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {selectedUsers.map(u => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(u)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs text-neutral-500">{u.email}</p>
                    </div>
                    <StatusBadge status={u.status} interval={u.interval} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
