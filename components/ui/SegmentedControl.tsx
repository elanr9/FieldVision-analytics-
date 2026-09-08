'use client';
import React from 'react';

export interface SegmentedControlProps { options: { key: string; label: string }[]; value: string; onChange?: (key: string) => void; style?: React.CSSProperties; }

/** Gray 12px-radius track with a white raised thumb; used for the date range picker. options: [{key,label}]. */
export function SegmentedControl({ options, value, onChange, style }: SegmentedControlProps) {
  return (
    <div style={{ display: 'flex', background: 'rgb(223 227 232 / .6)', borderRadius: 'var(--radius-lg)', padding: 4, ...style }}>
      {options.map(o => { const on = o.key === value; return (
        <button key={o.key} type="button" onClick={() => onChange && onChange(o.key)} style={{ flex: 1, minHeight: 40, border: 0, borderRadius: 'var(--radius-md)', padding: '8px 0', cursor: 'pointer', font: '600 12px/1.4 var(--font-sans)', background: on ? 'var(--surface-card)' : 'transparent', boxShadow: on ? 'var(--shadow-sm)' : 'none', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', transition: 'background-color var(--duration-fast) var(--ease-out)' }}>{o.label}</button>); })}
    </div>
  );
}
