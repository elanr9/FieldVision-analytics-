'use client';

import type { CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Mini } from '@/components/overview/Mini';
import { InkFunnelChart, type FunnelBar } from '@/components/charts/InkFunnelChart';
import type { Funnel, FunnelChapterKey, FunnelStep } from '@/lib/funnel';
import { count, minus, sharePct } from './format';

export interface GraphViewProps {
  funnel: Funnel;
  selectedStep: string | null;
  zoomChapter: FunnelChapterKey | null;
  onSelectStep: (id: string | null) => void;
  onZoom: (chapter: FunnelChapterKey | null) => void;
}

interface RowProps {
  title: string;
  sub: string;
  pct: string;
  lost: number | null;
  green?: boolean;
  onClick: () => void;
}

function Row({ title, sub, pct, lost, green, onClick }: RowProps) {
  const left = lost !== null && lost > 0;
  return (
    <button type="button" onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 16px', alignItems: 'center', gap: 10, width: '100%', padding: '7px 14px', background: 'none', border: 0, borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <span style={{ minWidth: 0 }}><span style={{ display: 'block', font: '600 13px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span><span style={{ display: 'block', font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{sub}</span></span>
      <span style={{ textAlign: 'right' }}><span style={{ display: 'block', font: '700 15px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: green ? 'var(--green-800)' : 'inherit' }}>{pct}</span><span style={{ display: 'block', font: '500 10px/1.4 var(--font-sans)', color: left ? 'var(--amber-800)' : 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{left ? '−' + lost + ' left' : ''}</span></span>
      <span style={{ color: 'var(--text-tertiary)', fontSize: 18, lineHeight: 1 }}>›</span>
    </button>
  );
}

const NAV_BUTTON: CSSProperties = { flex: 1, border: '1px solid var(--border-default)', background: 'var(--surface-card)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer', font: '600 13px var(--font-sans)', color: 'var(--ink-700)', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

const pct1 = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : 0);

export function GraphView({ funnel, selectedStep, zoomChapter, onSelectStep, onZoom }: GraphViewProps) {
  const f = funnel.steps, START = funnel.started, last = f[f.length - 1];
  const zc = zoomChapter ? funnel.chapters.find(c => c.key === zoomChapter) ?? null : null;
  const s = selectedStep ? f.find(st => st.id === selectedStep) ?? null : null;
  const si = s ? f.indexOf(s) : -1;
  const prev = si > 0 ? f[si - 1] : null, next = si >= 0 ? f[si + 1] : undefined;

  const chapterBars: FunnelBar[] = funnel.chapters.map((c, i) => ({ id: c.key, label: c.short, pct: pct1(c.exit, START), prevPct: i ? pct1(funnel.chapters[i - 1].exit, START) : 100, chapter: c.key === 'paywall' ? 'paywall' : 'x' }));
  const stepBars: FunnelBar[] = zc ? zc.steps.map((st, i) => { const before = i === 0 ? f[f.indexOf(st) - 1] : undefined; return { id: st.id, label: st.label, pct: st.pct, prevPct: before?.pct ?? undefined, chapter: st.chapter }; }) : [];
  const top: FunnelStep[] = zc ? [...zc.steps].filter(st => st.dropped !== null).sort((a, b) => (b.dropped ?? 0) - (a.dropped ?? 0)).slice(0, 3) : [];

  const zoomTo = (key: FunnelChapterKey) => { onZoom(key); onSelectStep(null); };
  const jump = (st: FunnelStep) => { onZoom(st.chapter); onSelectStep(st.id); };
  const onBar = (id: string) => {
    if (zc) {
      onSelectStep(id === selectedStep ? null : id);
      return;
    }
    const chapter = funnel.chapters.find(c => c.key === id);
    if (chapter) zoomTo(chapter.key);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Card padding="wide" style={{ minWidth: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 12 }}>
          {zc ? <button type="button" onClick={() => { onZoom(null); onSelectStep(null); }} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', font: '600 13px/1.4 var(--font-sans)', color: 'var(--ink-600)' }}>‹ All chapters</button> : <p style={{ margin: 0, font: '600 13px/1.4 var(--font-sans)' }}>{START} started · by chapter</p>}
          <p style={{ margin: 0, font: '700 13px/1.4 var(--font-sans)', color: 'var(--green-800)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{zc ? zc.label + ' · ' + sharePct(zc.exit, zc.enter) + ' got through' : count(last.pct) + '% paid'}</p>
        </div>
        <InkFunnelChart key={zoomChapter ?? 'all'} steps={zc ? stepBars : chapterBars} selected={selectedStep} onSelect={onBar} showLabels height={zc ? 150 : 132} />
        <p style={{ margin: '4px 0 0', font: '400 11px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>{zc ? 'Each bar is one step · % of the ' + START + ' who started' : '% of the ' + START + ' still in at the end of each chapter · hatched = left'}</p>
      </Card>
      {!zc && <Card padding="none"><div style={{ marginTop: -1 }}>{funnel.chapters.map(c => <Row key={c.key} title={c.label} sub={c.enter + ' came in · ' + c.exit + ' finished · ' + c.steps.length + ' steps'} pct={sharePct(c.exit, c.enter)} lost={c.enter - c.exit} green={c.key === 'paywall'} onClick={() => zoomTo(c.key)} />)}</div></Card>}
      {zc && s && <div key={s.id} style={{ animation: 'ink-fade var(--duration-base) var(--ease-out) both', display: 'grid', gap: 8 }}>
        <Card padding="wide">
          <p style={{ margin: 0, font: '500 11px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>Step {si + 1} of {f.length} · <span style={{ fontFamily: 'var(--font-mono)' }}>{s.id}</span></p>
          <p style={{ margin: '2px 0 12px', font: '700 17px/1.3 var(--font-sans)', letterSpacing: '-0.01em' }}>{s.label}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
            <Mini label="Got here" value={count(s.reached)} sub={count(s.pct) + '% of starters'} />
            <Mini label="Left here" value={minus(s.dropped)} sub={count(s.dropPct) + '% of arrivals'} />
            <Mini label="Went on" value={next ? sharePct(next.reached, s.reached) : '—'} sub="to next step" />
          </div>
        </Card>
        <div style={{ display: 'flex', gap: 8 }}>
          {prev && <button type="button" onClick={() => jump(prev)} style={{ ...NAV_BUTTON, textAlign: 'left' }}>‹ {prev.label}</button>}
          {next && <button type="button" onClick={() => jump(next)} style={{ ...NAV_BUTTON, textAlign: 'right' }}>{next.label} ›</button>}
        </div>
      </div>}
      {zc && !s && <Card padding="none"><p style={{ margin: 0, padding: '10px 14px 6px', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-tertiary)' }}>Where people leave this chapter</p>{top.map(st => <Row key={st.id} title={st.label} sub={(st.reached ?? 0) + (st.dropped ?? 0) + ' arrived · ' + count(st.reached) + ' continued'} pct={count(st.dropPct) + '%'} lost={st.dropped} onClick={() => onSelectStep(st.id)} />)}</Card>}
    </div>
  );
}
