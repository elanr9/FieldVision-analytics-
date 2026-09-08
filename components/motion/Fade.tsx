'use client';

import type { ReactNode } from 'react';

type FadeProps = { id: string | number; children: ReactNode };

/** Crossfades children whenever `id` changes. */
export function Fade({ id, children }: FadeProps) {
  return <div key={id} style={{ animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>{children}</div>;
}
