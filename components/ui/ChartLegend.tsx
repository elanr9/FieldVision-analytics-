import React from 'react';

export interface ChartLegendProps { items: { label: string; color: string }[]; style?: React.CSSProperties; }

/** Dot + label legend under a chart. items: [{label, color}] where color is a CSS value or token var. */
export function ChartLegend({ items, style }: ChartLegendProps) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 8, font: '400 12px/1.5 var(--font-sans)', color: 'var(--gray-600)', ...style }}>
      {items.map(it => (
        <span key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: it.color }} />{it.label}</span>
      ))}
    </div>
  );
}
