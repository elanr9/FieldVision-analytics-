'use client';

import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Hero } from '@/components/overview/Hero';
import { SUBSCRIBED_STEP_ID, TRIAL_STEP_ID, type Funnel, type FunnelStep } from '@/lib/funnel';
import { count, STARTED_NOUN, UNTRACKED_NOTE } from './format';
import { Rate } from './Rate';

export interface SummaryViewProps {
  funnel: Funnel;
  onStep: (id: string) => void;
}

const hasDrop = (s: FunnelStep): s is FunnelStep & { dropPct: number; dropped: number; reached: number } => s.dropPct !== null;

export function SummaryView({ funnel, onStep }: SummaryViewProps) {
  const f = funnel.steps;
  const by = (id: string): FunnelStep | undefined => f.find(s => s.id === id);
  const paid = by(SUBSCRIBED_STEP_ID) ?? f[f.length - 1];
  const trial = by(TRIAL_STEP_ID)?.reached ?? null;
  const paywallChapter = funnel.chapters[funnel.chapters.length - 1];
  const reachedPaywall = paywallChapter.steps[0]?.reached ?? null;
  const worst = f.filter(hasDrop).sort((a, b) => b.dropPct - a.dropPct).slice(0, 3);
  const fromAccounts = funnel.startedSource === 'accounts_created';
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Hero label={(fromAccounts ? 'Created an account' : 'Started onboarding') + ' → paid'} value={count(paid.pct) + '%'} accent caption={count(paid.reached) + ' of ' + funnel.started + ' ' + STARTED_NOUN[funnel.startedSource] + ' · last 30 days' + (funnel.untrackedSteps ? ' · ' + UNTRACKED_NOTE : '')} />
      <Card padding="wide" style={{ paddingTop: 2, paddingBottom: 2 }}>
        <Rate label="1 · Reach the paywall" a={funnel.started} b={reachedPaywall} />
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}><Rate label="2 · Start the free trial" a={reachedPaywall} b={trial} warn /></div>
        <div style={{ borderTop: '1px solid var(--border-subtle)' }}><Rate label="3 · Trial → paid" a={trial} b={paid.reached} warn /></div>
      </Card>
      <div>
        <SectionHeading>Where most people leave</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>{worst.map(w => <button key={w.id} type="button" onClick={() => onStep(w.id)} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: '10px 12px', minWidth: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}><p style={{ margin: 0, font: '600 12px/1.3 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label}</p><p style={{ margin: '4px 0 0', font: '700 20px/1.1 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: 'var(--amber-800)' }}>{w.dropPct}%</p><p style={{ margin: '2px 0 0', font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>leave here · {w.dropped} of {w.reached + w.dropped}</p></button>)}</div>
      </div>
    </div>
  );
}
