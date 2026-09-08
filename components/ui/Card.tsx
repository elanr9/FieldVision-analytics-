import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'children' | 'style'> {
  /** ink border instead of gray — used for the currently picked metric tile */
  selected?: boolean;
  padding?: 'default' | 'wide' | 'none';
  /** renders as a <button> */
  interactive?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** White container with 1px border and 16px radius. selected swaps the border to ink. padding: 'default' 12px | 'wide' 16px | 'none' for lists. */
export function Card({ selected, padding = 'default', interactive, onClick, children, style, ...rest }: CardProps) {
  const pad = { default: 12, wide: 16, none: 0 }[padding];
  const s: React.CSSProperties = { background: 'var(--surface-card)', border: `1px solid ${selected ? 'var(--border-strong)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-card)', padding: pad, boxSizing: 'border-box', overflow: padding === 'none' ? 'hidden' : undefined, textAlign: 'left', width: interactive ? '100%' : undefined, cursor: interactive ? 'pointer' : undefined, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', ...style };
  if (interactive) return <button type="button" onClick={onClick} style={s} {...rest}>{children}</button>;
  return <div onClick={onClick} style={s} {...rest}>{children}</div>;
}
