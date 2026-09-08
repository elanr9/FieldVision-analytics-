'use client';

import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Hero } from '@/components/overview/Hero';
import type { Funnel, FunnelStep } from '@/lib/funnel';
import { Rate } from './Rate';

export interface SummaryViewProps {
  funnel: Funnel;
  onStep: (id: string) => void;
}

const hasDrop = (s: FunnelStep): s is FunnelStep & { dropPct: number; dropped: number; reached: number } => s.dropPct !== null;

export function SummaryView({ funnel, onStep }: SummaryViewProps) {
  const f = funnel.steps;
  const by = (id: string): FunnelStep | undefined => f.find(s => s.id === id);
  const last = f[f.length - 1];
  const worst = f.filter(hasDrop).sort((a, b) => b.dropPct - a.dropPct).slice(0, 3);
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Hero label="Started survey → paid" value={(last.pct ?? 0) + '%'} accent caption={last.reached + ' of ' + funnel.started + ' people who started · last 30 days'} />
      <Card padding="wide" style={{ paddingTop: 2, paddingBottom: 2 }}>
        <Rate label="1 · Finish the survey" a={funnel.started} b={by('account_created')?.reached ?? null} />
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}><Rate label="2 · Start the free trial" a={by('account_created')?.reached ?? null} b={by('try_free')?.reached ?? null} warn /></div>
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}><Rate label="3 · Trial → paid" a={by('try_free')?.reached ?? null} b={last.reached} warn /></div>
      </Card>
      <div>
        <SectionHeading>Where most people leave</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>{worst.map(w => <button key={w.id} type="button" onClick={() => onStep(w.id)} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '10px 12px', minWidth: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}><p style={{ margin: 0, font: '600 12px/1.3 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label}</p><p style={{ margin: '4px 0 0', font: '700 20px/1.1 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: 'var(--amber-800)' }}>{w.dropPct}%</p><p style={{ margin: '2px 0 0', font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>leave here · {w.dropped} of {w.reached + w.dropped}</p></button>)}</div>
      </div>
    </div>
  );
}
