'use client';

import { useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

type Pager<T> = { slice: T[]; footer: ReactNode; page: number; setPage: Dispatch<SetStateAction<number>> };

const ARROWS: ReadonlyArray<readonly [string, number]> = [['‹', -1], ['›', 1]];

/** Fixed-size page of a list instead of a long scroll. Renders footer "1–6 of 14 ‹ ›". */
export function usePager<T>(items: T[], size: number): Pager<T> {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / size));
  useEffect(() => { if (page > pages - 1) setPage(0); }, [items.length]);
  const slice = items.slice(page * size, page * size + size);
  const footer = items.length > size ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 8px 16px', borderTop: '1px solid var(--border-subtle)', font: '500 12px/1.4 var(--font-sans)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
      <span>{page * size + 1}–{Math.min(items.length, (page + 1) * size)} of {items.length}</span>
      <span style={{ display: 'flex', gap: 4 }}>
        {ARROWS.map(([g, dir]) => { const off = dir < 0 ? page === 0 : page >= pages - 1; return <button key={g} type="button" disabled={off} onClick={() => setPage(p => p + dir)} style={{ width: 32, height: 32, borderRadius: 9999, border: 0, background: off ? 'transparent' : 'var(--gray-100)', color: off ? 'var(--gray-300)' : 'var(--ink-700)', cursor: off ? 'default' : 'pointer', font: '600 18px/1 var(--font-sans)' }}>{g}</button>; })}
      </span>
    </div>) : null;
  return { slice, footer, page, setPage };
}
