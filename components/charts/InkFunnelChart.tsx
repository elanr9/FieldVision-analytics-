'use client';

import type { CSSProperties } from 'react';

export interface FunnelBar {
  id: string;
  label: string;
  /** Grey note after the label, e.g. "12 steps" or "only some see this". */
  note?: string;
  /** People counted at this bar: finished the chapter, or reached the step. null when the apps do not record it yet. */
  count: number | null;
  /** People who arrived at this bar and left. Drawn as a hatched amber tail after the solid bar. null when unknown. */
  left: number | null;
  green?: boolean;
}

export interface InkFunnelChartProps {
  bars: FunnelBar[];
  /** Everyone who started. A full-width bar means all of them. */
  total: number;
  /** Legend text for the solid part, e.g. "finished the chapter". */
  solidLabel: string;
  selected: string | null;
  onSelect: (id: string) => void;
}

const DASH = '—';
const HATCH = 'repeating-linear-gradient(135deg, var(--amber-500) 0 1.5px, var(--amber-100) 1.5px 5px)';

const SWATCH: CSSProperties = { display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 5, verticalAlign: -1 };

function widthPct(n: number, total: number): string {
  return total ? Math.min(100, (n / total) * 100) + '%' : '0%';
}

interface RowText {
  stat: string;
  sub: string;
  subColor: string;
}

function rowText(bar: FunnelBar): RowText {
  if (bar.count === null) return { stat: DASH, sub: 'not tracked yet', subColor: 'var(--text-tertiary)' };
  if (bar.left === null) return { stat: String(bar.count), sub: '', subColor: 'var(--text-tertiary)' };
  const arrived = bar.count + bar.left;
  if (bar.left > 0) return { stat: bar.count + ' of ' + arrived, sub: '−' + bar.left + ' left', subColor: 'var(--amber-800)' };
  return { stat: bar.count + ' of ' + arrived, sub: 'no one left', subColor: 'var(--text-tertiary)' };
}

interface BarRowProps {
  bar: FunnelBar;
  total: number;
  index: number;
  on: boolean;
  onSelect: (id: string) => void;
}

function BarRow({ bar, total, index, on, onSelect }: BarRowProps) {
  const { stat, sub, subColor } = rowText(bar);
  const solid = bar.green ? 'var(--green-600)' : on ? 'var(--ink-900)' : 'var(--ink-700)';
  const untracked = bar.count === null;
  return (
    <button type="button" onClick={() => onSelect(bar.id)} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 12, width: '100%', padding: '9px 8px', background: on ? 'var(--ink-50)' : 'none', border: 0, borderTop: index ? '1px solid var(--border-subtle)' : 0, borderRadius: on ? 10 : 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <span style={{ minWidth: 0, display: 'grid', gap: 5 }}>
        <span style={{ font: `${on ? 700 : 600} 13px/1.3 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {bar.label}
          {bar.note && <span style={{ font: '400 11px var(--font-sans)', color: 'var(--text-tertiary)' }}> · {bar.note}</span>}
        </span>
        <span style={{ display: 'flex', height: 12, borderRadius: 6, background: 'var(--surface-track)', overflow: 'hidden', boxSizing: 'border-box', border: untracked ? '1px dashed var(--gray-300)' : undefined }}>
          {bar.count !== null && bar.count > 0 && <span style={{ width: widthPct(bar.count, total), background: solid, borderRadius: 6, transformOrigin: '0 0', animation: `ink-grow-x 600ms var(--ease-out) ${index * 30}ms both` }} />}
          {bar.left !== null && bar.left > 0 && <span style={{ width: widthPct(bar.left, total), backgroundImage: HATCH, borderRadius: '0 6px 6px 0', transformOrigin: '0 0', animation: `ink-grow-x 600ms var(--ease-out) ${index * 30}ms both` }} />}
        </span>
      </span>
      <span style={{ textAlign: 'right' }}>
        <span style={{ display: 'block', font: '700 13px/1.3 var(--font-sans)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: bar.green ? 'var(--green-800)' : 'inherit' }}>{stat}</span>
        {sub && <span style={{ display: 'block', font: '500 10px/1.3 var(--font-sans)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: subColor }}>{sub}</span>}
      </span>
    </button>
  );
}

/** Horizontal funnel, one row per chapter or step. Bar length is people out of `total`; solid = stayed in, hatched amber tail = left here. */
export function InkFunnelChart({ bars, total, solidLabel, selected, onSelect }: InkFunnelChartProps) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 14, marginBottom: 4, font: '500 11px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>
        <span><span style={{ ...SWATCH, background: 'var(--ink-700)' }} />{solidLabel}</span>
        <span><span style={{ ...SWATCH, backgroundImage: HATCH }} />left</span>
      </div>
      <div style={{ margin: '0 -8px' }}>
        {bars.map((bar, i) => <BarRow key={bar.id} bar={bar} total={total} index={i} on={selected === bar.id} onSelect={onSelect} />)}
      </div>
    </div>
  );
}
