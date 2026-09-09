'use client';

export interface NameRowProps {
  name: string;
  /** Right-hand caption: plan, trial timing, or why the account is here */
  right: string;
  /** Optional second line under the name */
  sub?: string;
  onOpen: () => void;
}

export function NameRow({ name, right, sub, onOpen }: NameRowProps) {
  return (
    <button type="button" onClick={onOpen} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', padding: '11px 16px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <span style={{ minWidth: 0 }}><span style={{ display: 'block', font: '500 14px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>{sub && <span style={{ display: 'block', font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>{sub}</span>}</span>
      <span style={{ flexShrink: 0, font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{right}</span>
    </button>
  );
}
