'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ChartLegend } from '@/components/ui/ChartLegend';
import { CountUp, Fade, type Screen } from '@/components/motion';
import { InkBars } from '@/components/charts/InkBars';
import { formatUsd } from '@/lib/stripe-revenue';
import type { Bucket, Totals } from '@/lib/overview';
import type { UserRecord } from '@/lib/types';
import { Hero } from './Hero';
import { Mini } from './Mini';
import { MiniToggle } from './MiniToggle';
import { UsageBar } from './UsageBar';
import { SAMPLE_PLATFORM, SAMPLE_USAGE } from './sampleUsage';

type View = 'revenue' | 'growth' | 'usage';
type Grain = 'weeks' | 'months';

export interface OverviewTabProps {
  months: Bucket[];
  weeks: Bucket[];
  totals: Totals;
  real: UserRecord[];
  push: (s: Screen) => void;
}

const pct = (num: number, den: number) => (den ? Math.round(num / den * 1000) / 10 : 0) + '%';

export function OverviewTab({ months, weeks, totals }: OverviewTabProps) {
  const [view, setView] = useState<View>('revenue');
  const [grain, setGrain] = useState<Grain>('months');
  const [sel, setSel] = useState<number | null>(null);
  const buckets = grain === 'months' ? months : weeks;
  const T = totals;
  useEffect(() => setSel(null), [grain, view]);
  const picked = sel != null ? buckets[sel] : null;
  const usage = [...SAMPLE_USAGE].sort((a, b) => b.events30 - a.events30), maxU = usage[0].events30;
  const bestMonth = months.reduce((best, m) => (m.revenue > best.revenue ? m : best), months[0]);
  const head = (title: string) => <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><SectionHeading style={{ marginBottom: 0 }}>{title}</SectionHeading><MiniToggle<Grain> value={grain} onChange={setGrain} options={[['weeks', 'Weeks'], ['months', 'Months']]} /></div>;
  const g3 = { display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 };
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <SegmentedControl value={view} onChange={k => setView(k as View)} options={[{ key: 'revenue', label: 'Revenue' }, { key: 'growth', label: 'Growth' }, { key: 'usage', label: 'Usage' }]} />
      <Fade id={view}>
        {view === 'revenue' && <div style={{ display: 'grid', gap: 12 }}>
          <Hero label="All-time revenue" value={formatUsd(T.revenue)} accent caption={T.payments + ' payments since ' + months[0].label} right={<div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ margin: 0, font: '700 18px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}><CountUp value={formatUsd(T.mrr)} /></p><p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-secondary)' }}>MRR</p></div>} />
          <Card padding="wide" style={{ paddingBottom: 10 }}>
            {head(picked ? (picked.label + (grain === 'weeks' ? ' week' : '') + ' · ' + formatUsd(picked.revenue) + (picked.partial ? ' so far' : '')) : 'Revenue by ' + (grain === 'months' ? 'month' : 'week'))}
            <InkBars data={buckets} series={[{ key: 'revenue', color: 'var(--chart-revenue)' }]} format={v => '$' + Math.round(v / 100 / 100) / 10 + 'k'} selected={sel} onSelect={setSel} />
          </Card>
          {/* README overrides mock tiles here */}
          <div style={g3}>
            <Mini label="ARR" value={formatUsd(T.mrr * 12)} sub="from MRR" />
            <Mini label="Avg / payer" value={formatUsd(T.payingEver ? T.revenue / T.payingEver : 0)} sub={T.payingEver + ' payers'} accent />
            <Mini label="Best month" value={formatUsd(bestMonth.revenue)} sub={bestMonth.label} />
          </div>
        </div>}
        {view === 'growth' && <div style={{ display: 'grid', gap: 12 }}>
          <Hero label="All-time signups" value={T.signups} caption={T.trials + ' started a trial · ' + T.payingEver + ' paid'} right={<div style={{ textAlign: 'right', flexShrink: 0 }}><p style={{ margin: 0, font: '700 18px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: 'var(--metric-money)' }}><CountUp value={pct(T.payingEver, T.signups)} /></p><p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-secondary)' }}>signup → paid</p></div>} />
          <Card padding="wide" style={{ paddingBottom: 10 }}>
            {head(picked ? (picked.label + ' · ' + picked.signups + ' signups · ' + picked.trials + ' trials · ' + picked.paying + ' paid') : 'Signups · trials · paid by ' + (grain === 'months' ? 'month' : 'week'))}
            <InkBars data={buckets} series={[{ key: 'signups', color: 'var(--chart-signups)' }, { key: 'trials', color: 'var(--chart-trials)' }, { key: 'paying', color: 'var(--chart-conversions)' }]} selected={sel} onSelect={setSel} />
            <ChartLegend items={[{ label: 'Signups', color: 'var(--chart-signups)' }, { label: 'Trials', color: 'var(--chart-trials)' }, { label: 'Paid', color: 'var(--chart-conversions)' }]} style={{ marginTop: 4, gap: 12 }} />
          </Card>
          {/* README overrides mock tiles here */}
          <div style={g3}>
            <Mini label="Paying now" value={T.payingNow} accent />
            <Mini label="Trialing" value={T.trialingNow} />
            <Mini label="Trial → paid" value={(T.trials ? Math.round(T.payingEver / T.trials * 100) : 0) + '%'} sub={T.payingEver + ' of ' + T.trials + ' trials'} />
          </div>
        </div>}
        {view === 'usage' && <div style={{ display: 'grid', gap: 12 }}>
          <Hero label="Feature events · 30 days" value={SAMPLE_USAGE.reduce((s, f) => s + f.events30, 0)} caption={Math.max(...SAMPLE_USAGE.map(f => f.users30)) + ' active users · ' + SAMPLE_USAGE.length + ' features tracked'} />
          <Card padding="wide" style={{ paddingTop: 6, paddingBottom: 6 }}>
            {/* TODO(handoff-3): push UsageScreen focused on f.id */}
            {usage.slice(0, 6).map(f => <UsageBar key={f.id} f={f} max={maxU} onClick={() => {}} />)}
            {/* TODO(handoff-3): push UsageScreen */}
            <button type="button" onClick={() => {}} style={{ display: 'block', width: '100%', padding: '10px 0 6px', background: 'none', border: 0, borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', font: '600 13px/1.3 var(--font-sans)', color: 'var(--ink-600)', textAlign: 'left' }}>Full breakdown ›</button>
          </Card>
          <div>
            <SectionHeading><span style={{ display: 'inline-flex', alignItems: 'center' }}>On Inkbound · all time<span style={{ font: '600 10px/1.4 var(--font-sans)', padding: '2px 8px', borderRadius: 9999, background: 'var(--gray-100)', color: 'var(--text-secondary)', marginLeft: 8, textTransform: 'none', letterSpacing: 'normal' }}>Sample data</span></span></SectionHeading>
            <div style={g3}>
              <Mini label="Coach convos" value={SAMPLE_PLATFORM.conversations} sub={SAMPLE_PLATFORM.replies + ' replies'} accent />
              <Mini label="Highlight vids" value={SAMPLE_PLATFORM.videos} sub={SAMPLE_PLATFORM.videosPublished + ' published'} />
              <Mini label="Emails opened" value={SAMPLE_PLATFORM.emailsOpened.toLocaleString()} sub={Math.round(SAMPLE_PLATFORM.emailsOpened / SAMPLE_PLATFORM.emailsSent * 100) + '% of ' + SAMPLE_PLATFORM.emailsSent.toLocaleString()} />
              <Mini label="Campaigns" value={SAMPLE_PLATFORM.campaigns} sub="sent to coaches" />
              <Mini label="Schools saved" value={SAMPLE_PLATFORM.schoolsSaved.toLocaleString()} sub="in search" />
              <Mini label="Calls booked" value={SAMPLE_PLATFORM.calls} sub="with Elan" />
            </div>
          </div>
        </div>}
      </Fade>
    </div>
  );
}
