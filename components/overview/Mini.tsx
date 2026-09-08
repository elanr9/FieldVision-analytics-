'use client';

import { CountUp } from '@/components/motion';

export interface MiniProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
}

/** Small stat tile used in the 3-up grids under each Overview chart. */
export function Mini({ label, value, sub, accent }: MiniProps) {
  return <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '10px 12px', minWidth: 0 }}><p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p><p style={{ margin: '2px 0 0', font: '700 18px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--metric-money)' : 'inherit' }}><CountUp value={value} /></p>{sub && <p style={{ margin: '2px 0 0', font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</p>}</div>;
}
