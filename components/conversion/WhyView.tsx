'use client';

import { Hero } from '@/components/overview/Hero';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatCard } from '@/components/ui/StatCard';
import type { ConversionReport } from '@/lib/conversion/report';
import { Bars } from './Bars';
import type { Drill } from './ConversionTab';
import { money, monthly, people } from './format';

export interface WhyViewProps {
  report: ConversionReport;
  caption: string;
  drill: Drill;
}

export function WhyView({ report, caption, drill }: WhyViewProps) {
  const h = report.headline;
  const topReason = report.reasons[0];
  const churnedIds = report.outcomes.filter(o => o.outcome === 'paid_churned' || o.outcome === 'refunded').flatMap(o => o.userIds);
  const lostValue = [h.assumedCount ? `${h.assumedCount} at the $20 default` : 'if every lost trial had paid', h.lostOneTimeCents ? `+ ${money(h.lostOneTimeCents)} once` : null].filter(Boolean).join(' ');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Hero label="Trial → paid" value={h.trials ? h.trialToPaidPct + '%' : 'No trials'} accent={h.trials > 0 && h.trialToPaidPct >= 50} caption={h.trials ? `${h.converted} of ${h.trials} trials paid${h.boughtWithoutTrial ? `, ${h.boughtWithoutTrial} more bought outright` : ''} · ${caption}` : `Nobody started a trial in ${caption.replace('trials from ', '')}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
        <StatCard label="Lost trials" value={h.lostTrials} sub="started, not paying today" onClick={() => drill.cases('Lost trials', h.lostTrialUserIds, 'Everyone who started a trial and is not paying today')} />
        <StatCard label="Lost MRR" value={money(h.lostMonthlyCents)} sub={lostValue} size="sm" />
        <StatCard label="Real churn" value={h.paidChurned} sub="paid, then left" onClick={() => drill.cases('Paid, then left', churnedIds)} />
      </div>

      {topReason && (
        <Card padding="wide" style={{ borderLeft: `4px solid ${topReason.accent}` }}>
          <p style={{ margin: 0, font: '600 11px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>Biggest reason</p>
          <p style={{ margin: '4px 0 0', font: '700 18px/1.25 var(--font-sans)' }}>{topReason.title}</p>
          <p style={{ margin: '6px 0 0', font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{topReason.meaning}</p>
          <p style={{ margin: '8px 0 0', font: '600 12px/1.4 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{people(topReason.count)}{h.lost >= 5 ? ` · ${topReason.pctOfLost}% of everyone lost` : ''}{topReason.lostMonthlyCents ? ` · ${monthly(topReason.lostMonthlyCents)} on the table` : ''}</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button type="button" onClick={() => drill.ask(`Why are ${topReason.count} athletes in "${topReason.title}"? Walk me through what the data says and what you would change first.`)} style={{ border: 0, borderRadius: 'var(--radius-full)', padding: '7px 13px', background: 'var(--action-primary)', color: 'var(--text-inverse)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' }}>Ask the agent</button>
            <button type="button" onClick={() => drill.cases(topReason.title, topReason.userIds, topReason.meaning)} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--surface-card)', color: 'var(--ink-700)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' }}>{people(topReason.count)}</button>
          </div>
        </Card>
      )}

      <div>
        <SectionHeading count={report.leaks[0]?.count}>Where the leak is</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <Bars rows={report.leaks.map(s => ({ key: s.key, label: s.label, value: s.count, detail: s.dropPct === null ? 'everyone' : s.key === 'converted' ? `${s.pct}% of signups · ${100 - s.dropPct}% of trials` : `${s.pct}% of signups · lost ${s.dropPct}%`, color: s.key === 'converted' ? 'var(--green-500)' : undefined, onClick: () => drill.people(s.label, s.userIds) }))} />
        </Card>
      </div>

      <div>
        <SectionHeading count={h.lost}>Why they left</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 6, paddingBottom: 6 }}>
          <Bars rows={report.reasons.map(r => ({ key: r.reason, label: r.title, value: r.count, detail: `${r.pctOfLost}%${r.lostMonthlyCents ? ` · ${monthly(r.lostMonthlyCents)}` : ''}`, color: r.accent, onClick: () => drill.cases(r.title, r.userIds, r.meaning) }))} />
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
