'use client';
import React from 'react';

export interface StatCardProps {
  /** uppercase eyebrow, e.g. "Trial started" or "Gross · Last 30 days" */
  label: string;
  value: string | number;
  /** small gray line, e.g. "42.9% of signups" */
  sub?: string;
  /** green number — money and paying only */
  accent?: boolean;
  /** ink border when this tile drives the people list */
  selected?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  style?: React.CSSProperties;
}

/** Clickable metric tile: eyebrow label, big tabular number, one-line sub. accent = money green. */
export function StatCard({ label, value, sub, accent, selected, size = 'md', onClick, style }: StatCardProps) {
  const num = size === 'lg' ? 30 : size === 'sm' ? 20 : 24;
  return (
    <button type="button" onClick={onClick} style={{ display: 'block', width: '100%', textAlign: 'left', boxSizing: 'border-box', background: 'var(--surface-card)', border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-card)', padding: size === 'lg' ? 16 : 12, cursor: onClick ? 'pointer' : 'default', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', minWidth: 0, ...style }}>
      <p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</p>
      <p style={{ margin: '4px 0 0', font: `700 ${num}px/1.25 var(--font-sans)`, fontVariantNumeric: 'tabular-nums', color: accent ? 'var(--metric-money)' : 'var(--metric-neutral)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
      {sub && <p style={{ margin: '4px 0 0', font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>{sub}</p>}
    </button>
  );
}
