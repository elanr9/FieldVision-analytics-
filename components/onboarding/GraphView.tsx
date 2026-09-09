'use client';

import type { CSSProperties } from 'react';
import { Card } from '@/components/ui/Card';
import { Mini } from '@/components/overview/Mini';
import { InkFunnelChart, type FunnelBar } from '@/components/charts/InkFunnelChart';
import type { Funnel, FunnelChapterKey, FunnelStep } from '@/lib/funnel';
import { count, minus, sharePct, STARTED_NOUN, UNTRACKED_NOTE } from './format';

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

export function GraphView({ funnel, selectedStep, zoomChapter, onSelectStep, onZoom }: GraphViewProps) {
  const f = funnel.steps, START = funnel.started, last = f[f.length - 1];
  const zc = zoomChapter ? funnel.chapters.find(c => c.key === zoomChapter) ?? null : null;
  const s = selectedStep ? f.find(st => st.id === selectedStep) ?? null : null;
  const si = s ? f.indexOf(s) : -1;
  const prev = si > 0 ? f[si - 1] : null, next = si >= 0 ? f[si + 1] : undefined;

  const chapterBars: FunnelBar[] = funnel.chapters.map(c => ({ id: c.key, label: c.label, note: c.steps.length + ' steps', count: c.exit, left: c.enter === null || c.exit === null ? null : c.enter - c.exit, green: c.key === 'paywall' }));
  const stepBars: FunnelBar[] = zc ? zc.steps.map(st => ({ id: st.id, label: st.label, note: st.conditional ? 'only some see this' : undefined, count: st.reached, left: st.dropped, green: st.chapter === 'paywall' })) : [];
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
        {zc && <button type="button" onClick={() => { onZoom(null); onSelectStep(null); }} style={{ background: 'none', border: 0, padding: 0, marginBottom: 6, cursor: 'pointer', font: '600 13px/1.4 var(--font-sans)', color: 'var(--ink-600)' }}>‹ All chapters</button>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 12 }}>
          <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)', letterSpacing: '-0.01em' }}>{zc ? zc.label : START + ' ' + (funnel.startedSource === 'accounts_created' ? 'accounts' : 'started')}</p>
          <p style={{ margin: 0, font: '700 13px/1.4 var(--font-sans)', color: 'var(--green-800)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{zc ? count(zc.exit) + ' of ' + count(zc.enter) + ' got through' : count(last.reached) + ' paid · ' + sharePct(last.reached, START)}</p>
        </div>
        <InkFunnelChart key={zoomChapter ?? 'all'} bars={zc ? stepBars : chapterBars} total={START} solidLabel={zc ? 'reached this step' : 'finished the chapter'} selected={selectedStep} onSelect={onBar} />
        <p style={{ margin: '8px 0 0', font: '400 11px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>{'Full bar = all ' + START + ' ' + STARTED_NOUN[funnel.startedSource] + (zc ? ' · tap a step for details' : ' · tap a chapter to see its steps')}{funnel.untrackedSteps ? ' · ' + UNTRACKED_NOTE : ''}</p>
      </Card>
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
