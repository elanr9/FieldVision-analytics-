'use client';

import type { ReactNode } from 'react';

type SheetProps = { open: boolean; onClose: () => void; children: ReactNode };

/** Bottom sheet with scrim; used for the drafted check-in text. */
export function Sheet({ open, onClose, children }: SheetProps) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgb(20 25 32 / .4)', animation: 'ink-fade var(--duration-base) var(--ease-out) both', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 768, background: 'var(--surface-card)', borderRadius: '20px 20px 0 0', padding: '12px 16px calc(var(--safe-bottom) + 20px)', animation: 'ink-sheet 320ms var(--ease-out) both', boxSizing: 'border-box' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--gray-300)', margin: '0 auto 12px' }} />
        {children}
      </div>
    </div>
  );
}
