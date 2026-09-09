export interface InkLineSeries {
  key: string;
  color: string;
}

export interface InkLinePoint {
  label: string;
  [key: string]: string | number;
}

export interface InkLineChartProps {
  data: InkLinePoint[];
  series: InkLineSeries[];
  height?: number;
}

function num(v: string | number | undefined): number {
  return typeof v === 'number' ? v : 0;
}

/** Line chart with dashed gridlines and up to 6 x labels. Ported verbatim from the mock's Charts.jsx. */
export function InkLineChart({ data, series, height = 224 }: InkLineChartProps) {
  const w = 700, h = height, padL = 28, padB = 22, padT = 8;
  const max = Math.max(1, ...data.flatMap(d => series.map(s => num(d[s.key]))));
  const x = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (w - padL - 8);
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height, display: 'block', fontFamily: 'var(--font-sans)' }}>
      {ticks.map(t => <g key={t}><line x1={padL} x2={w - 8} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeDasharray="3 3" /><text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--gray-500)">{t}</text></g>)}
      {data.map((d, i) => i % Math.ceil(data.length / 6) === 0 ? <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="11" fill="var(--gray-500)">{d.label}</text> : null)}
      {series.map(s => <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" points={data.map((d, i) => x(i) + ',' + y(num(d[s.key]))).join(' ')} style={{ strokeDasharray: 2000, strokeDashoffset: 2000, animation: 'ink-draw 900ms var(--ease-out) forwards' }} />)}
    </svg>
  );
}
