'use client';
import React from 'react';

export interface HeaderStatProps {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  active?: boolean;
  onClick?: () => void;
}

/** Compact stat in the sticky header: bold value over 10px uppercase label. Dimmed to 80% unless active. */
export function HeaderStat({ label, value, accent, active, onClick }: HeaderStatProps) {
  return (
    <button type="button" onClick={onClick} style={{ flexShrink: 0, textAlign: 'right', background: 'none', border: 0, padding: 0, cursor: 'pointer', opacity: active ? 1 : 'var(--muted-opacity)', fontFamily: 'var(--font-sans)' }}>
      <p style={{ margin: 0, font: '700 14px/1.25 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--metric-money)' : 'var(--text-primary)' }}>{value}</p>
      <p style={{ margin: 0, font: '400 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{label}</p>
    </button>
  );
}
