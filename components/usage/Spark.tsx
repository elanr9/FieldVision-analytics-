export interface SparkProps {
  days: number[];
  color?: string;
  h?: number;
  w?: number;
}

/** Tiny polyline sparkline that draws itself in. */
export function Spark({ days, color = 'var(--ink-700)', h = 28, w = 96 }: SparkProps) {
  const max = Math.max(1, ...days);
  const pts = days.map((v, i) => (i / (days.length - 1) * w) + ',' + (h - v / max * (h - 2) - 1)).join(' ');
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: 'ink-draw 800ms var(--ease-out) forwards' }} /></svg>;
}
