'use client';
import React, { useState } from 'react';

export interface ButtonProps extends Omit<React.HTMLAttributes<HTMLElement>, 'onClick' | 'children' | 'style'> {
  /** primary = ink navy; money = green (outreach "Text"); secondary = gray; ghost = transparent */
  variant?: 'primary' | 'money' | 'secondary' | 'ghost';
  /** lg = 12px radius, 14px text (forms, profile actions); sm = 8px radius, 12px text (row actions) */
  size?: 'sm' | 'lg';
  disabled?: boolean;
  /** stretch to fill (flex:1 / width:100%) */
  block?: boolean;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/** Text-label button. variant: primary (ink) | money (green, used for Text/outreach) | secondary (gray) | ghost. size: sm (row actions) | lg (full-width). */
export function Button({ variant = 'primary', size = 'lg', disabled, block, children, onClick, href, style, ...rest }: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);
  const bg = { primary: hover ? 'var(--action-primary-hover)' : 'var(--action-primary)', money: hover ? 'var(--green-800)' : 'var(--green-600)', secondary: hover ? 'var(--action-secondary-hover)' : 'var(--action-secondary)', ghost: hover ? 'var(--gray-100)' : 'transparent' }[variant];
  const fg = variant === 'primary' || variant === 'money' ? 'var(--text-inverse)' : 'var(--gray-700)';
  const s: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: 0, cursor: disabled ? 'default' : 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)', fontWeight: 600, background: bg, color: fg, opacity: disabled ? 'var(--disabled-opacity)' : 1,
    transition: 'background-color var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
    transform: press && !disabled ? `scale(${size === 'lg' ? 'var(--press-scale)' : 'var(--press-scale-sm)'})` : 'none',
    ...(size === 'lg' ? { borderRadius: 'var(--radius-lg)', padding: '10px 16px', fontSize: 14, lineHeight: '20px', width: block ? '100%' : undefined, flex: block ? 1 : undefined } : { borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 12, lineHeight: '16px', minHeight: 36, minWidth: 56 }),
    ...style,
  };
  const handlers = {
    onClick,
    style: s,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => { setHover(false); setPress(false); },
    onMouseDown: () => setPress(true),
    onMouseUp: () => setPress(false),
  };
  if (href) return <a href={href} {...handlers} {...rest}>{children}</a>;
  return <button type="button" disabled={disabled} {...handlers} {...rest}>{children}</button>;
}
