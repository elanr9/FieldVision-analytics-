'use client';
import React, { useState } from 'react';

export interface TabsProps {
  tabs: { key: string; label: string; /** green count pill (follow-ups) */ badge?: number }[];
  value: string;
  onChange?: (key: string) => void;
  style?: React.CSSProperties;
}

/** Pill tab strip; active = ink fill, white text. Each tab: {key, label, badge?}. */
export function Tabs({ tabs, value, onChange, style }: TabsProps) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <nav style={{ display: 'flex', gap: 4, ...style }}>
      {tabs.map(t => { const on = t.key === value; return (
        <button key={t.key} type="button" onClick={() => onChange && onChange(t.key)} onMouseEnter={() => setHover(t.key)} onMouseLeave={() => setHover(null)}
          style={{ position: 'relative', flex: 1, minHeight: 44, border: 0, borderRadius: 'var(--radius-full)', padding: '8px 4px', whiteSpace: 'nowrap', cursor: 'pointer', font: '600 13px/1.25 var(--font-sans)', background: on ? 'var(--action-primary)' : hover === t.key ? 'rgb(223 227 232 / .6)' : 'transparent', color: on ? 'var(--text-inverse)' : 'var(--text-secondary)', transition: 'background-color var(--duration-fast) var(--ease-out)' }}>
          {t.label}
          {t.badge ? <span style={{ position: 'absolute', top: -4, right: 0, borderRadius: 'var(--radius-full)', background: 'var(--green-500)', color: '#fff', padding: '1px 6px', font: '700 10px/1.4 var(--font-sans)' }}>{t.badge}</span> : null}
        </button>); })}
    </nav>
  );
}
