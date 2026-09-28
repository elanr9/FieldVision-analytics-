'use client';

export interface BarRow {
  key: string;
  label: string;
  value: number;
  /** Small right aligned text after the value, e.g. "$160/mo" */
  detail?: string;
  color?: string;
  onClick?: () => void;
}

/** Horizontal bars with a label, count and optional detail. Tappable rows push a people list. */
export function Bars({ rows }: { rows: BarRow[] }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map(r => {
        const Row = r.onClick ? 'button' : 'div';
        return (
        <Row
          key={r.key}
          type={r.onClick ? 'button' : undefined}
          onClick={r.onClick}
          style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', width: '100%', padding: '6px 0', background: 'none', border: 0, textAlign: 'left', cursor: r.onClick ? 'pointer' : 'default', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, font: '600 13px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</p>
            <div style={{ marginTop: 5, height: 8, borderRadius: 4, background: 'var(--surface-track)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.max(2, (r.value / max) * 100) + '%', borderRadius: 4, background: r.color ?? 'var(--ink-700)', transformOrigin: '0 0', animation: 'ink-grow-x 600ms var(--ease-out) both' }} />
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, font: '700 16px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{r.value}</p>
            {r.detail && <p style={{ margin: 0, font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.detail}</p>}
          </div>
        </Row>
        );
      })}
    </div>
  );
}

export interface ColumnBucket {
  label: string;
  count: number;
  onClick?: () => void;
}

/** Small vertical histogram, one column per bucket. */
export function Columns({ buckets, color = 'var(--ink-700)' }: { buckets: ColumnBucket[]; color?: string }) {
  const max = Math.max(1, ...buckets.map(b => b.count));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${buckets.length}, minmax(0, 1fr))`, gap: 6, alignItems: 'end', height: 120 }}>
      {buckets.map(b => (
        <button key={b.label} type="button" onClick={b.onClick} disabled={!b.onClick || b.count === 0} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', gap: 4, background: 'none', border: 0, padding: 0, cursor: b.onClick && b.count ? 'pointer' : 'default', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', minWidth: 0 }}>
          <span style={{ font: '600 11px/1 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: b.count ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{b.count}</span>
          <div style={{ width: '100%', height: Math.max(3, (b.count / max) * 80), borderRadius: 4, background: b.count ? color : 'var(--surface-track)', transformOrigin: '0 100%', animation: 'ink-grow 500ms var(--ease-out) both' }} />
          <span style={{ font: '400 9px/1.2 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{b.label}</span>
        </button>
      ))}
    </div>
  );
}
