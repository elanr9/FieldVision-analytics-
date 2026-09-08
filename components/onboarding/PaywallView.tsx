'use client';

import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Hero } from '@/components/overview/Hero';
import { Mini } from '@/components/overview/Mini';
import { CountUp } from '@/components/motion';
import type { Paywall } from '@/lib/funnel';
import { count, share, sharePct } from './format';

export interface PaywallViewProps {
  paywall: Paywall;
}

interface StepProps {
  label: string;
  n: number | null;
  /** The row above; the % column is n's share of it. */
  of?: number | null;
  note?: string;
  indent?: number;
  green?: boolean;
  warn?: boolean;
}

function Step({ label, n, of, note, indent = 0, green, warn }: StepProps) {
  const pct = of === undefined ? null : share(n, of);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 44px', alignItems: 'center', gap: 8, padding: '7px 14px', paddingLeft: 14 + indent * 14, borderTop: '1px solid var(--border-subtle)' }}>
      <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{indent ? <span style={{ width: 6, height: 6, borderRadius: 3, background: green ? 'var(--green-600)' : 'var(--ink-300)', flexShrink: 0 }} /> : null}<span style={{ minWidth: 0 }}><span style={{ display: 'block', font: `${indent ? 500 : 600} 13px/1.4 var(--font-sans)`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>{note && <span style={{ display: 'block', font: '400 10px/1.3 var(--font-sans)', color: 'var(--text-tertiary)' }}>{note}</span>}</span></span>
      <span style={{ textAlign: 'right', font: '700 14px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: green ? 'var(--green-800)' : 'inherit' }}>{count(n)}</span>
      <span style={{ textAlign: 'right', font: '500 11px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: warn ? 'var(--amber-800)' : 'var(--text-tertiary)' }}>{pct === null ? '' : pct + '%'}</span>
    </div>
  );
}

export function PaywallView({ paywall: P }: PaywallViewProps) {
  const W = P.wheel;
  const paidTotal = P.plans.reduce((sum, p) => sum + p.paid, 0);
  const bestRate = Math.max(...P.plans.map(p => (p.trials ? p.paid / p.trials : 0)));
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Hero label="Saw the paywall → paid" value={sharePct(paidTotal, P.seen)} accent caption={paidTotal + ' of ' + count(P.seen) + ' who hit the paywall · last 30 days'} right={<div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ margin: 0, font: '700 18px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: 'var(--amber-800)' }}><CountUp value={count(P.stalled10m)} /></p><p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-secondary)' }}>stalled 10 min+</p></div>} />
      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ marginTop: -1 }}>
          <Step label="Saw the paywall" n={P.seen} note="% column = share of the row above it" />
          <Step label="Started a trial right away" n={P.trialDirect} of={P.seen} indent={1} green />
          <Step label="Closed the paywall" n={P.closed} of={P.seen} indent={1} warn />
          <Step label="Landed on the wheel" n={W.entered} of={P.closed} indent={2} />
          <Step label="Spun it" n={W.spun} of={W.entered} indent={2} />
          <Step label="Saw the 90% off screen" n={W.offer90} of={W.spun} indent={2} />
          <Step label="Started a trial from the offer" n={W.trial} of={W.offer90} indent={2} green />
          <Step label="Paid after the offer" n={W.paid} of={W.trial} indent={2} green />
        </div>
      </Card>
      <div>
        <SectionHeading>Trial → paid by plan</SectionHeading>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>{P.plans.map(p => <Mini key={p.key} label={p.label} value={sharePct(p.paid, p.trials)} sub={p.paid + ' of ' + p.trials + ' trials'} accent={p.trials > 0 && p.paid / p.trials === bestRate} />)}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
        <Mini label="Wheel → paid" value={sharePct(W.paid, W.entered)} sub={count(W.paid) + ' paid of ' + count(W.entered) + ' who saw the wheel'} />
        <Mini label="Cancel save offer" value={sharePct(P.save.accepted, P.save.shown)} sub={count(P.save.accepted) + ' of ' + count(P.save.shown) + ' took the free month'} />
      </div>
    </div>
  );
}
