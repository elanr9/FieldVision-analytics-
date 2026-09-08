'use client';

export interface FunnelBar {
  id: string;
  label: string;
  /** % of starters still in at this bar. null when the source event does not exist yet; drawn as an empty slot. */
  pct: number | null;
  /** % at the bar before this one when it is not in the list (first bar of a zoomed chapter). */
  prevPct?: number;
  chapter: string;
}

export interface InkFunnelChartProps {
  steps: FunnelBar[];
  selected: string | null;
  onSelect: (id: string) => void;
  showLabels?: boolean;
  height?: number;
}

/** Step funnel that always fits the width: bars sized to the step count; solid = reached, hatched cap = left at this step; green = paywall. */
export function InkFunnelChart({ steps, selected, onSelect, showLabels, height = 150 }: InkFunnelChartProps) {
  const w = 360, padL = 30, h = height, xLabels = showLabels && steps.length <= 8, padB = xLabels ? 16 : 6, padT = 12, n = steps.length;
  const slot = (w - padL - 2) / n, gap = n > 20 ? Math.min(2, slot * 0.25) : 4, bw = Math.max(1.5, slot - gap);
  const y = (p: number) => padT + (1 - p / 100) * (h - padT - padB);
  let lastMeasured: number | null = null;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block', fontFamily: 'var(--font-sans)' }}>
      <defs><pattern id="ink-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.4" height="4" fill="var(--ink-200)" /></pattern></defs>
      {[0, 25, 50, 75, 100].map(p => <g key={p}><line x1={padL} x2={w} y1={y(p)} y2={y(p)} stroke="var(--chart-grid)" /><text x={padL - 6} y={y(p) + 3.5} textAnchor="end" fontSize="10" fill="var(--gray-500)">{p}%</text></g>)}
      {steps.map((s, i) => {
        const x = padL + i * slot + gap / 2;
        const on = selected === s.id;
        const prev = lastMeasured ?? s.prevPct ?? s.pct ?? 0;
        if (s.pct !== null) lastMeasured = s.pct;
        const pct = s.pct;
        return (
          <g key={s.id} onClick={() => onSelect(s.id)} style={{ cursor: 'pointer' }}>
            <rect x={padL + i * slot} y={0} width={slot} height={h - padB} fill={on ? 'var(--ink-50)' : 'transparent'} rx="3" />
            {pct !== null && prev > pct && <rect x={x} y={y(prev)} width={bw} height={Math.max(0, y(pct) - y(prev))} fill="url(#ink-hatch)" rx={bw > 6 ? 2 : 0} />}
            {pct !== null && <rect x={x} y={y(pct)} width={bw} height={Math.max(0, y(0) - y(pct))} rx={bw > 6 ? 2 : 0} fill={s.chapter === 'paywall' ? 'var(--green-600)' : on ? 'var(--ink-900)' : 'var(--ink-700)'} style={{ transformOrigin: `0 ${y(0)}px`, animation: `ink-grow 500ms var(--ease-out) ${i * (n > 20 ? 6 : 25)}ms both` }} />}
            {showLabels && bw > 14 && <text x={x + bw / 2} y={y(pct === null ? 0 : Math.max(prev, pct)) - 4} textAnchor="middle" fontSize={bw > 30 ? 11 : 9} fontWeight="700" fill={on ? 'var(--ink-900)' : 'var(--gray-700)'} style={{ fontVariantNumeric: 'tabular-nums' }}>{pct === null ? '—' : Math.round(pct) + '%'}</text>}
            {xLabels && <text x={x + bw / 2} y={h - 3} textAnchor="middle" fontSize="10" fontWeight={on ? 700 : 500} fill={on ? 'var(--ink-900)' : 'var(--gray-500)'}>{s.label}</text>}
          </g>
        );
      })}
    </svg>
  );
}
