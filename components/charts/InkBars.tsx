'use client';

import type { Bucket } from '@/lib/overview';

export type InkBarsSeriesKey = 'revenue' | 'signups' | 'trials' | 'paying';

export interface InkBarsProps {
  data: Bucket[];
  series: { key: InkBarsSeriesKey; color: string }[];
  format?: (v: number) => string;
  selected: number | null;
  onSelect: (i: number | null) => void;
  height?: number;
}

/** Grouped bar chart with tappable slots. Partial (current) buckets are hatched. */
export function InkBars({ data, series, format = v => String(v), selected, onSelect, height = 176 }: InkBarsProps) {
  const w = 360, h = height, padL = 0, padB = 20, padT = 22;
  const n = data.length, slot = (w - padL) / n, gw = Math.min(slot * 0.72, 40), bw = gw / series.length;
  const max = Math.max(1, ...data.flatMap(dd => series.map(s => dd[s.key])));
  const y = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', maxHeight: height * 1.4, display: 'block', fontFamily: 'var(--font-sans)' }}>
      <defs><pattern id="ink-hatch2" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="rgb(255 255 255 / .55)" /></pattern></defs>
      {[0.5, 1].map(p => <line key={p} x1={padL} x2={w} y1={y(max * p)} y2={y(max * p)} stroke="var(--chart-grid)" strokeDasharray="3 3" />)}
      <line x1={padL} x2={w} y1={y(0)} y2={y(0)} stroke="var(--border-default)" />
      {data.map((dd, i) => { const on = selected === i, x0 = padL + i * slot + (slot - gw) / 2; return (
        <g key={i} onClick={() => onSelect(on ? null : i)} style={{ cursor: 'pointer' }}>
          <rect x={padL + i * slot} y={0} width={slot} height={h} fill={on ? 'var(--ink-50)' : 'transparent'} rx="6" />
          {series.map((s, si) => { const v = dd[s.key]; const top = y(v); return <g key={s.key}><rect x={x0 + si * bw + 1} y={top} width={Math.max(0, bw - 2)} height={Math.max(0, y(0) - top)} rx="3" fill={s.color} opacity={selected != null && !on ? 0.45 : 1} style={{ transformOrigin: `0 ${y(0)}px`, animation: `ink-grow 500ms var(--ease-out) ${i * 30}ms both`, transition: 'opacity var(--duration-fast)' }} />{dd.partial && <rect x={x0 + si * bw + 1} y={top} width={Math.max(0, bw - 2)} height={Math.max(0, y(0) - top)} rx="3" fill="url(#ink-hatch2)" />}</g>; })}
          {(on || series.length === 1) && <text x={x0 + gw / 2} y={y(Math.max(...series.map(s => dd[s.key]))) - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill={on ? 'var(--ink-900)' : 'var(--gray-500)'} style={{ fontVariantNumeric: 'tabular-nums' }}>{format(series.length === 1 ? dd[series[0].key] : dd[series[series.length - 1].key])}</text>}
          {(n <= 8 || i % 2 === 0 || on) && <text x={padL + i * slot + slot / 2} y={h - 5} textAnchor="middle" fontSize="10" fill={on ? 'var(--ink-900)' : 'var(--gray-500)'} fontWeight={on ? 600 : 400}>{dd.label}</text>}
        </g>); })}
    </svg>
  );
}
