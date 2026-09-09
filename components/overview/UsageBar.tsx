'use client';

import { FIcon } from './FIcon';
import type { UsageFeature } from '@/lib/usage';

export interface UsageBarProps {
  f: UsageFeature;
  max: number;
}

/** One feature row: icon · label · track bar · "61 users". */
export function UsageBar({ f, max }: UsageBarProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '16px 104px 1fr auto', alignItems: 'center', gap: 10, width: '100%', padding: '9px 0', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <FIcon path={f.icon} />
      <span style={{ font: '500 13px/1.3 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>
      <span style={{ height: 8, borderRadius: 4, background: 'var(--surface-track)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (f.events30 / max * 100) + '%', borderRadius: 4, background: 'var(--ink-700)', animation: 'ink-grow-x 600ms var(--ease-out) both', transformOrigin: '0 0' }} /></span>
      <span style={{ font: '600 13px/1.3 var(--font-sans)', fontVariantNumeric: 'tabular-nums', minWidth: 48, textAlign: 'right' }}>{f.users30}<span style={{ font: '400 11px var(--font-sans)', color: 'var(--text-tertiary)' }}> users</span></span>
    </div>
  );
}
