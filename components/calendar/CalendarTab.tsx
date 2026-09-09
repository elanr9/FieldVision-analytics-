'use client';

import { useMemo, useState } from 'react';
import { usePager } from '@/components/motion';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useNav } from '@/components/shell/nav';
import type { UserRecord } from '@/lib/types';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local-time day key "yyyy-m-d" (month 0-based) so signups group by the viewer's calendar day. */
export const dayKey = (d: Date): string => d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();

/** `junk` arrives once lib/users.ts lands; until then a record without it is treated as not junk. */
const isJunk = (u: UserRecord): boolean => (u as UserRecord & { junk?: boolean }).junk === true;

/** real = no excluded accounts, no parents, no junk. */
export function realSignups(users: UserRecord[]): UserRecord[] {
  return users.filter(u => !u.excludedFromMetrics && !u.isParent && !isJunk(u));
}

export function groupByDay(users: UserRecord[]): Record<string, UserRecord[]> {
  const byDay: Record<string, UserRecord[]> = {};
  users.forEach(u => { const k = dayKey(new Date(u.signupDate)); (byDay[k] = byDay[k] || []).push(u); });
  return byDay;
}

/** Rows per page in the selected-day panel so the tab never scrolls at 393×852. A six-row month has room for three rows but not three rows plus the pager footer, so it pages two at a time once paging is needed. */
export function panelPageSize(monthRows: number, signups: number): number {
  if (monthRows === 6 && signups > 3) return 2;
  return 3;
}

/** Month grid of signups per day; tap a day for its signups, tap a person for the profile. */
export function CalendarTab({ users }: { users: UserRecord[] }) {
  const { open } = useNav();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState<string | null>(null);
  const byDay = useMemo(() => groupByDay(realSignups(users)), [users]);
  const first = month.getDay(), dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array<null>(first).fill(null), ...Array.from({ length: dim }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  const today = dayKey(new Date());
  const shift = (n: number) => { setSel(null); setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1)); };
  const selected = sel ? byDay[sel] || [] : [];
  const rows = Math.ceil((first + dim) / 7);
  const pager = usePager(selected, panelPageSize(rows, selected.length));
  const pick = (k: string, on: boolean) => { setSel(on ? null : k); pager.setPage(0); };
  return (
    <Card padding="wide">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Button size="sm" variant="ghost" onClick={() => shift(-1)} style={{ minWidth: 0, color: 'var(--gray-600)', fontSize: 14 }}>←</Button>
        <p style={{ margin: 0, font: '700 14px/1.5 var(--font-sans)' }}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        <Button size="sm" variant="ghost" onClick={() => shift(1)} style={{ minWidth: 0, color: 'var(--gray-600)', fontSize: 14 }}>→</Button>
      </div>
      <div key={month.getTime()} style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, textAlign: 'center', animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>
        {WEEKDAYS.map(w => <p key={w} style={{ margin: 0, paddingBottom: 4, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{w}</p>)}
        {cells.map((d, i) => { if (!d) return <div key={'e' + i} />; const k = dayKey(d), on = sel === k, n = (byDay[k] || []).length; return (
          <button key={k} type="button" onClick={() => pick(k, on)} style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: 0, borderRadius: 'var(--radius-md)', cursor: 'pointer', font: '500 12px/1.4 var(--font-sans)', background: on ? 'var(--ink-700)' : k === today ? 'var(--ink-50)' : 'transparent', color: on ? '#fff' : k === today ? 'var(--ink-800)' : 'var(--text-primary)', transition: 'background-color var(--duration-fast), transform var(--duration-fast)', transform: on ? 'scale(1.04)' : 'none' }}>
            <span>{d.getDate()}</span>
            {n > 0 && <span style={{ marginTop: 2, borderRadius: 9999, padding: '0 6px', font: '700 10px/1.5 var(--font-sans)', background: on ? 'rgb(255 255 255 / .25)' : 'var(--ink-100)', color: on ? '#fff' : 'var(--ink-700)' }}>{n}</span>}
          </button>); })}
      </div>
      {sel && <div key={sel} style={{ marginTop: 16, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>
        <p style={{ margin: 0, padding: '10px 16px', borderBottom: '1px solid var(--border-default)', font: '600 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>Signups on {new Date(...(sel.split('-').map(Number) as [number, number, number])).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        {selected.length === 0 ? <p style={{ margin: 0, padding: 16, font: '400 14px var(--font-sans)', color: 'var(--text-secondary)' }}>No signups this day.</p> :
          pager.slice.map((u, i) => <button key={u.id} type="button" onClick={() => open(u)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px', border: 0, borderTop: i ? '1px solid var(--border-subtle)' : 0, background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
            <div style={{ minWidth: 0 }}><p style={{ margin: 0, font: '500 14px/1.5 var(--font-sans)' }}>{u.name}</p><p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{u.email}</p></div><StatusBadge status={u.status} />
          </button>)}
        {pager.footer}
      </div>}
    </Card>
  );
}
