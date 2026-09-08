'use client';

import type React from 'react';
import { CountUp } from '@/components/motion';

export interface HeroProps {
  label: string;
  value: string | number;
  caption?: string;
  accent?: boolean;
  right?: React.ReactNode;
}

/** Big number + caption; the anchor of each Overview view. */
export function Hero({ label, value, caption, accent, right }: HeroProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '4px 2px 0' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, font: '600 11px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>{label}</p>
        <p style={{ margin: '2px 0 0', font: '700 34px/1.1 var(--font-sans)', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--metric-money)' : 'var(--text-primary)' }}><CountUp value={value} /></p>
        {caption && <p style={{ margin: '4px 0 0', font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>{caption}</p>}
      </div>
      {right}
    </div>
  );
}
