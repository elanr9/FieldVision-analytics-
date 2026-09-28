'use client';

import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { ConversionReport, Medians } from '@/lib/conversion/report';
import { Columns } from './Bars';
import type { Drill } from './ConversionTab';
import { days, pct } from './format';

export interface PatternsViewProps {
  report: ConversionReport;
  drill: Drill;
}

const cell: React.CSSProperties = { padding: '8px 0', font: '400 13px/1.4 var(--font-sans)', borderTop: '1px solid var(--border-subtle)' };
const num: React.CSSProperties = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 };

function CompareRow({ label, a, b, format = String }: { label: string; a: number; b: number; format?: (n: number) => string }) {
  const better = a > b ? 'a' : b > a ? 'b' : null;
  return (
    <>
      <div style={cell}>{label}</div>
      <div style={{ ...num, color: better === 'a' ? 'var(--green-600)' : 'inherit' }}>{format(a)}</div>
      <div style={{ ...num, color: better === 'b' ? 'var(--red-600)' : 'inherit' }}>{format(b)}</div>
    </>
  );
}

function Compare({ converters, lost }: { converters: Medians; lost: Medians }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 16 }}>
      <div style={{ ...cell, borderTop: 0, color: 'var(--text-tertiary)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>Median during trial</div>
      <div style={{ ...num, borderTop: 0, color: 'var(--green-600)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase' }}>Paid · {converters.people}</div>
      <div style={{ ...num, borderTop: 0, color: 'var(--red-600)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase' }}>Lost · {lost.people}</div>
      <CompareRow label="Sent a campaign" a={converters.activatedPct} b={lost.activatedPct} format={n => n + '%'} />
      <CompareRow label="Coach emails" a={converters.emailsSent} b={lost.emailsSent} />
      <CompareRow label="Replies" a={converters.repliesReceived} b={lost.repliesReceived} />
      <CompareRow label="Videos" a={converters.videosCreated} b={lost.videosCreated} />
      <CompareRow label="Active days" a={converters.activeDays} b={lost.activeDays} />
    </div>
  );
}

export function PatternsView({ report, drill }: PatternsViewProps) {
  const h = report.headline;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <SectionHeading>Paid vs lost, same 7 days</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <Compare converters={report.comparison.converters} lost={report.comparison.lost} />
        </Card>
      </div>

      <div>
        <SectionHeading>{h.medianDaysToCancel === null ? 'When they cancel' : `When they cancel · median ${days(h.medianDaysToCancel)}`}</SectionHeading>
        <Card padding="wide">
          <Columns color="var(--red-500)" buckets={report.timeToCancel.map(b => ({ label: b.label, count: b.count, onClick: () => drill.cases(`Canceled · ${b.label}`, b.userIds) }))} />
          <p style={{ margin: '10px 0 0', font: '400 11px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>Trial end is the day 7 auto cancel. Later means the cancel landed after access had already lapsed or been charged.</p>
        </Card>
      </div>

      <div>
        <SectionHeading>By plan they tried</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', columnGap: 14 }}>
            {['Plan', 'Trials', 'Paid', 'Rate'].map((label, i) => <div key={label} style={{ ...cell, borderTop: 0, textAlign: i ? 'right' : 'left', color: 'var(--text-tertiary)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{label}</div>)}
            {report.plans.map(p => (
              <button key={p.plan} type="button" onClick={() => drill.cases(p.label, p.userIds)} style={{ display: 'contents', background: 'none', border: 0, padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'inherit' }}>
                <div style={cell}>{p.label}</div>
                <div style={num}>{p.trials}</div>
                <div style={num}>{p.converted}</div>
                <div style={{ ...num, color: (p.ratePct ?? 0) >= 50 ? 'var(--green-600)' : 'var(--amber-800)' }}>{pct(p.ratePct)}</div>
              </button>
            ))}
          </div>
          {report.plans.length === 0 && <p style={{ margin: 0, padding: '12px 0', font: '400 13px var(--font-sans)', color: 'var(--text-secondary)' }}>No plan data in this range.</p>}
        </Card>
      </div>

      <div>
        <SectionHeading>By signup month</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', columnGap: 14 }}>
            {['Month', 'Signups', 'Trials', 'Paid', 'Rate'].map((label, i) => <div key={label} style={{ ...cell, borderTop: 0, textAlign: i ? 'right' : 'left', color: 'var(--text-tertiary)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{label}</div>)}
            {report.cohorts.map(c => (
              <div key={c.month} style={{ display: 'contents' }}>
                <div style={cell}>{c.label}</div>
                <div style={num}>{c.signups}</div>
                <div style={num}>{c.trials}</div>
                <div style={num}>{c.converted}</div>
                <div style={{ ...num, color: c.ratePct === null ? 'var(--text-tertiary)' : c.ratePct >= 50 ? 'var(--green-600)' : 'var(--amber-800)' }}>{pct(c.ratePct)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
