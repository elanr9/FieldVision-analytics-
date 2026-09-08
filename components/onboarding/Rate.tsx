'use client';

import { count, share } from './format';

export interface RateProps {
  label: string;
  /** People who arrived. */
  a: number | null;
  /** People who made it through. */
  b: number | null;
  /** Amber when under 50%. */
  warn?: boolean;
}

/** One headline conversion row: label, "b of a people · lost", track bar and the percent. */
export function Rate({ label, a, b, warn }: RateProps) {
  const pct = share(b, a);
  const low = warn && pct !== null && pct < 50;
  const lost = a === null || b === null ? '—' : String(a - b);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12, padding: '9px 0' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, font: '600 13px/1.4 var(--font-sans)' }}>{label}</p>
        <p style={{ margin: 0, font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{count(b)} of {count(a)} people · {lost} lost</p>
        <div style={{ marginTop: 6, height: 6, borderRadius: 3, background: 'var(--surface-track)', overflow: 'hidden' }}><div style={{ height: '100%', width: (pct ?? 0) + '%', borderRadius: 3, background: low ? 'var(--amber-500)' : 'var(--ink-700)', transformOrigin: '0 0', animation: 'ink-grow-x 600ms var(--ease-out) both' }} /></div>
      </div>
      <p style={{ margin: 0, font: '700 20px/1 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: low ? 'var(--amber-800)' : 'inherit' }}>{pct === null ? '—' : pct + '%'}</p>
    </div>
  );
}
