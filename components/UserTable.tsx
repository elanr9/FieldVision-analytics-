'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatDay } from '@/lib/dates';
import { STATUS_LABEL, type UserRecord, type UserStatus } from '@/lib/types';
import ContactActions from './ContactActions';
import StatusBadge from './StatusBadge';

const FILTERS: (UserStatus | 'all')[] = [
  'all',
  'paying',
  'trialing',
  'trial_ended',
  'signed_up',
  'churned',
  'comped',
];

/** Full user list, searchable and filterable. Tap a row to open the profile. */
export default function UserTable({ users }: { users: UserRecord[] }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserStatus | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(u => {
      if (filter !== 'all' && u.status !== filter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.team ?? '').toLowerCase().includes(q) ||
        (u.phone ?? '').includes(q)
      );
    });
  }, [users, search, filter]);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-neutral-200 p-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, team, or phone"
          className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-base outline-none focus:border-emerald-500"
        />
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <p className="px-4 pt-3 text-xs text-neutral-500">{filtered.length} users</p>

      <ul className="divide-y divide-neutral-100">
        {filtered.map(u => (
          <li key={u.id} className="flex items-center hover:bg-neutral-50">
            <Link
              href={`/users/${u.id}`}
              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {u.name}
                  {u.team && <span className="ml-1.5 text-xs font-normal text-neutral-400">{u.team}</span>}
                  {u.isParent && (
                    <span className="ml-1.5 text-[10px] font-semibold text-neutral-400">PARENT</span>
                  )}
                  {u.excludedFromMetrics && (
                    <span className="ml-1.5 rounded bg-neutral-800 px-1 py-px text-[9px] font-bold text-white">
                      INTERNAL
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-neutral-500">
                  {u.email}
                  {u.phone ? ` · ${u.phone}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={u.status} interval={u.interval} />
                <span className="text-[10px] text-neutral-400">Joined {formatDay(u.signupDate)}</span>
              </div>
            </Link>
            <div className="hidden shrink-0 pr-4 sm:block">
              <ContactActions user={u} />
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-neutral-500">No users match.</li>
        )}
      </ul>
    </div>
  );
}
