export interface DeltaProps {
  /** Percent change; green at or above zero, red below */
  v: number;
}

export function Delta({ v }: DeltaProps) {
  const up = v >= 0;
  return <span style={{ font: '600 11px/1.2 var(--font-sans)', color: up ? 'var(--green-800)' : 'var(--red-800)', background: up ? 'var(--green-100)' : 'var(--red-100)', borderRadius: 9999, padding: '2px 7px', fontVariantNumeric: 'tabular-nums' }}>{up ? '+' : ''}{v}%</span>;
}
