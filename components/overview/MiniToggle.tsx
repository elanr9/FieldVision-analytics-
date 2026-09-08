'use client';

export interface MiniToggleProps<K extends string> {
  value: K;
  onChange: (key: K) => void;
  options: [K, string][];
}

/** Tiny text toggle used inside section headers: Weeks · Months. */
export function MiniToggle<K extends string>({ value, onChange, options }: MiniToggleProps<K>) {
  return (
    <div style={{ display: 'flex', gap: 2, background: 'var(--gray-100)', borderRadius: 9999, padding: 2, flexShrink: 0 }}>
      {options.map(([k, l]) => <button key={k} type="button" onClick={() => onChange(k)} style={{ border: 0, borderRadius: 9999, padding: '4px 10px', cursor: 'pointer', font: '600 11px/1.4 var(--font-sans)', background: value === k ? 'var(--surface-card)' : 'transparent', color: value === k ? 'var(--text-primary)' : 'var(--text-secondary)', boxShadow: value === k ? 'var(--shadow-sm)' : 'none', transition: 'all var(--duration-fast) var(--ease-out)' }}>{l}</button>)}
    </div>
  );
}
