import React from 'react';

export interface StatBlockProps { label: string; value: React.ReactNode; }

/** Sunken gray stat used in the dossier Activity grid: number over label, centered. */
export function StatBlock({ label, value }: StatBlockProps) {
  return (
    <div style={{ background: 'var(--surface-page)', borderRadius: 'var(--radius-lg)', padding: '10px 12px', textAlign: 'center', fontFamily: 'var(--font-sans)' }}>
      <p style={{ margin: 0, font: '700 18px/1.25 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' }}>{value}</p>
      <p style={{ margin: '2px 0 0', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}
