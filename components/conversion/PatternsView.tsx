'use client';

import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import type { ConversionReport, GroupBehavior } from '@/lib/conversion/report';
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
      <div style={{ ...num, color: better === 'a' ? 'var(--green-600)' : 'inherit', whiteSpace: 'nowrap' }}>{format(a)}</div>
      <div style={{ ...num, color: better === 'b' ? 'var(--red-600)' : 'inherit', whiteSpace: 'nowrap' }}>{format(b)}</div>
    </>
  );
}

/** Under five trials a percent is noise, so show the fraction in a neutral color instead. */
const SMALL_BASE = 5;

function rateText(ratePct: number | null, converted: number, trials: number): string {
  if (ratePct === null || trials === 0) return 'no trials';
  if (trials < SMALL_BASE) return `${converted} of ${trials}`;
  return pct(ratePct);
}

function rateColor(ratePct: number | null, trials: number): string {
  if (ratePct === null || trials < SMALL_BASE) return 'var(--text-tertiary)';
  return ratePct >= 50 ? 'var(--green-600)' : 'var(--amber-800)';
}

const headCell: React.CSSProperties = { ...cell, borderTop: 0, color: 'var(--text-tertiary)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' };

function perPerson(total: number, people: number): string {
  if (people === 0) return '0';
  const each = total / people;
  return `${total} · ${each >= 10 ? Math.round(each) : Math.round(each * 10) / 10} each`;
}

function Compare({ converters, lost }: { converters: GroupBehavior; lost: GroupBehavior }) {
  const pct = (n: number) => n + '%';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 14 }}>
      <div style={headCell}>In the first 7 days</div>
      <div style={{ ...num, borderTop: 0, color: 'var(--green-600)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase' }}>Paid · {converters.people}</div>
      <div style={{ ...num, borderTop: 0, color: 'var(--red-600)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase' }}>Lost · {lost.people}</div>
      <CompareRow label="Did anything real" a={converters.activatedPct} b={lost.activatedPct} format={pct} />
      <CompareRow label="Sent coach emails" a={converters.emailedInTrialPct} b={lost.emailedInTrialPct} format={pct} />
      <CompareRow label="Made a video" a={converters.videoInTrialPct} b={lost.videoInTrialPct} format={pct} />
      <CompareRow label="Active days, average" a={converters.activeDaysAvg} b={lost.activeDaysAvg} />
      <div style={{ ...headCell, borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>All time, whole group</div>
      <div style={{ ...num, borderTop: '1px solid var(--border-subtle)' }} />
      <div style={{ ...num, borderTop: '1px solid var(--border-subtle)' }} />
      <CompareRow label="Coach emails sent" a={converters.emailsTotal} b={lost.emailsTotal} format={n => perPerson(n, n === converters.emailsTotal ? converters.people : lost.people)} />
      <CompareRow label="Coach replies" a={converters.repliesTotal} b={lost.repliesTotal} format={n => perPerson(n, n === converters.repliesTotal ? converters.people : lost.people)} />
      <CompareRow label="Got at least one reply" a={converters.everRepliedPct} b={lost.everRepliedPct} format={pct} />
      <CompareRow label="Campaigns" a={converters.campaignsTotal} b={lost.campaignsTotal} />
      <CompareRow label="Videos made" a={converters.videosTotal} b={lost.videosTotal} />
      <CompareRow label="Videos published" a={converters.videosPublishedTotal} b={lost.videosPublishedTotal} />
    </div>
  );
}

export function PatternsView({ report, drill }: PatternsViewProps) {
  const h = report.headline;
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <SectionHeading>Paid vs lost</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <Compare converters={report.comparison.converters} lost={report.comparison.lost} />
        </Card>
      </div>

      <div>
        <SectionHeading>{h.medianDaysToCancel === null ? 'When they cancel' : `When they cancel · median ${days(h.medianDaysToCancel)}`}</SectionHeading>
        <Card padding="wide">
          <Columns color="var(--red-500)" buckets={report.timeToCancel.map(b => ({ label: b.label, count: b.count, onClick: () => drill.cases(`Canceled · ${b.label}`, b.userIds) }))} />
          <p style={{ margin: '10px 0 0', font: '400 11px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>Days count from the trial start. End is a cancel that landed exactly when the 7 day trial ran out. Later means it happened after access had already lapsed or the card was charged.</p>
        </Card>
      </div>

      <div>
        <SectionHeading>By plan they tried</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', columnGap: 14 }}>
            {['Plan', 'Trials', 'Paid', 'Rate'].map((label, i) => <div key={label} style={{ ...cell, borderTop: 0, textAlign: i ? 'right' : 'left', color: 'var(--text-tertiary)', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)' }}>{label}</div>)}
            {report.plans.map(p => (
              <div key={p.plan} role="button" tabIndex={0} onClick={() => drill.cases(p.label, p.userIds)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drill.cases(p.label, p.userIds); } }} style={{ display: 'grid', gridColumn: '1 / -1', gridTemplateColumns: 'subgrid', cursor: 'pointer' }}>
                <div style={cell}>{p.label}</div>
                <div style={num}>{p.trials}</div>
                <div style={num}>{p.converted}</div>
                <div style={{ ...num, color: rateColor(p.ratePct, p.trials) }}>{rateText(p.ratePct, p.converted, p.trials)}</div>
              </div>
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
              <div key={c.month} role="button" tabIndex={0} onClick={() => drill.cases(`Signed up ${c.label}`, c.userIds)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drill.cases(`Signed up ${c.label}`, c.userIds); } }} style={{ display: 'grid', gridColumn: '1 / -1', gridTemplateColumns: 'subgrid', cursor: 'pointer' }}>
                <div style={cell}>{c.label}</div>
                <div style={num}>{c.signups}</div>
                <div style={num}>{c.trials}</div>
                <div style={num}>{c.converted}</div>
                <div style={{ ...num, color: rateColor(c.ratePct, c.trials) }}>{rateText(c.ratePct, c.converted, c.trials)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
