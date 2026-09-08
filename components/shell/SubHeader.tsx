'use client';
import type { ReactNode } from 'react';

export interface SubHeaderProps {
  title: string;
  onBack: () => void;
  right?: ReactNode;
}

export function SubHeader({ title, onBack, right }: SubHeaderProps) {
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 20, margin: '0 -16px', padding: 'calc(var(--safe-top) + 10px) 12px 10px', background: 'rgb(247 248 250 / .92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-default)', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center' }}>
      <button type="button" onClick={onBack} style={{ justifySelf: 'start', background: 'none', border: 0, padding: '6px 4px', cursor: 'pointer', font: '500 15px/1.2 var(--font-sans)', color: 'var(--ink-600)', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ fontSize: 20, lineHeight: '16px' }}>‹</span> Back</button>
      <p style={{ margin: 0, font: '600 15px/1.2 var(--font-sans)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>{title}</p>
      <div style={{ justifySelf: 'end' }}>{right}</div>
    </div>
  );
}
