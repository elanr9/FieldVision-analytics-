'use client';

import { Hero } from '@/components/overview/Hero';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatCard } from '@/components/ui/StatCard';
import type { ConversionReport } from '@/lib/conversion/report';
import { Bars } from './Bars';
import type { Drill } from './ConversionTab';
import { monthly, people } from './format';

export interface WhyViewProps {
  report: ConversionReport;
  caption: string;
  drill: Drill;
}

export function WhyView({ report, caption, drill }: WhyViewProps) {
  const h = report.headline;
  const lostTrials = report.outcomes.filter(o => o.outcome !== 'converted' && o.outcome !== 'still_trialing' && o.outcome !== 'stopped_at_paywall' && o.outcome !== 'abandoned_onboarding' && o.outcome !== 'never_opened');
  const lostTrialIds = lostTrials.flatMap(o => o.userIds);
  const topReason = report.reasons[0];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Hero label="Trial → paid" value={h.trialToPaidPct + '%'} accent={h.trialToPaidPct >= 50} caption={`${h.converted} of ${h.trials} trials paid · ${caption}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
        <StatCard label="Lost trials" value={lostTrialIds.length} sub="started, never paid" onClick={() => drill.cases('Lost trials', lostTrialIds, 'Everyone who started a trial and is not paying today')} />
        <StatCard label="Lost MRR" value={monthly(h.lostMonthlyCents)} sub="if they had all paid" />
        <StatCard label="Real churn" value={h.paidChurned} sub="paid, then left" onClick={() => drill.cases('Paid, then left', report.outcomes.filter(o => o.outcome === 'paid_churned' || o.outcome === 'refunded').flatMap(o => o.userIds))} />
      </div>

      {topReason && (
        <Card padding="wide" style={{ borderLeft: `4px solid ${topReason.accent}` }}>
          <p style={{ margin: 0, font: '600 11px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>Biggest reason</p>
          <p style={{ margin: '4px 0 0', font: '700 18px/1.25 var(--font-sans)' }}>{topReason.title}</p>
          <p style={{ margin: '6px 0 0', font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{topReason.meaning}</p>
          <p style={{ margin: '8px 0 0', font: '600 12px/1.4 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{people(topReason.count)} · {topReason.pctOfLost}% of everyone lost{topReason.lostMonthlyCents ? ` · ${monthly(topReason.lostMonthlyCents)} on the table` : ''}</p>
        </Card>
      )}

      <div>
        <SectionHeading count={report.leaks[0]?.count}>Where the leak is</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <Bars rows={report.leaks.map(s => ({ key: s.key, label: s.label, value: s.count, detail: s.dropPct === null ? '100%' : `${s.pct}% · lost ${s.dropPct}%`, color: s.key === 'converted' ? 'var(--green-500)' : undefined, onClick: () => drill.people(s.label, s.userIds) }))} />
        </Card>
      </div>

      <div>
        <SectionHeading count={h.lost}>Why they left</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <Bars rows={report.reasons.map(r => ({ key: r.reason, label: r.title, value: r.count, detail: r.lostMonthlyCents ? monthly(r.lostMonthlyCents) : `${r.pctOfLost}%`, color: r.accent, onClick: () => drill.cases(r.title, r.userIds, r.meaning) }))} />
          {report.reasons.length === 0 && <p style={{ margin: 0, padding: '16px 0', textAlign: 'center', font: '400 13px var(--font-sans)', color: 'var(--text-secondary)' }}>Nobody lost in this range.</p>}
        </Card>
      </div>

      <div>
        <SectionHeading>Every outcome</SectionHeading>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {report.outcomes.map(o => (
            <button key={o.outcome} type="button" onClick={() => drill.cases(o.label, o.userIds)} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 10px', background: 'var(--surface-card)', color: 'var(--text-primary)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer', fontVariantNumeric: 'tabular-nums' }}>
              {o.label} <span style={{ color: 'var(--text-tertiary)' }}>{o.count}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
