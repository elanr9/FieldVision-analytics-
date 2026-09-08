'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type Screen = { key: string; node: ReactNode };

type ScreenStackProps = { screens: Screen[]; popping: boolean };

/** Screen stack: the top screen slides in from the right; pop slides it back out. Underlying screen dims and parallaxes. */
export function ScreenStack({ screens, popping }: ScreenStackProps) {
  const top = screens.length - 1;
  const [settled, setSettled] = useState(false);
  useEffect(() => { setSettled(false); const t = setTimeout(() => setSettled(true), 340); return () => clearTimeout(t); }, [screens.length, popping]);
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      {screens.map((s, i) => {
        const isTop = i === top, under = i === top - 1;
        const anim = isTop && i > 0 ? (popping ? 'ink-pop 320ms var(--ease-out) both' : 'ink-push 320ms var(--ease-out) both') : under ? (popping ? 'ink-under-back 320ms var(--ease-out) both' : 'ink-under 320ms var(--ease-out) both') : 'none';
        return <div key={s.key} aria-hidden={!isTop} style={{ position: isTop ? 'relative' : 'absolute', inset: 0, background: 'var(--surface-page)', animation: anim, willChange: 'transform', pointerEvents: isTop ? 'auto' : 'none', visibility: !isTop && settled && !popping ? 'hidden' : 'visible', minHeight: '100vh', height: isTop ? undefined : '100vh', overflow: isTop ? undefined : 'hidden', zIndex: i }}>{s.node}</div>;
      })}
    </div>
  );
}
