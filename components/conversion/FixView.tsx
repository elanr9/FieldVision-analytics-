'use client';

import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { REASON_META } from '@/lib/conversion/reasons';
import type { ConversionReport } from '@/lib/conversion/report';
import { AiInsights } from './AiInsights';
import { Bars } from './Bars';
import type { Drill } from './ConversionTab';
import { monthly, people } from './format';

export interface FixViewProps {
  report: ConversionReport;
  range: string;
  drill: Drill;
}

export function FixView({ report, range, drill }: FixViewProps) {
  const recoverable = report.fixes.reduce((sum, f) => sum + f.recoverableMonthlyCents, 0);
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <AiInsights range={range} drill={drill} />

      <div>
        <SectionHeading count={report.fixes.length}>Rule based playbook{recoverable ? ` · ${monthly(recoverable)} at stake` : ''}</SectionHeading>
        <div style={{ display: 'grid', gap: 10 }}>
          {report.fixes.map((f, i) => (
            <Card key={f.reason} padding="wide" style={{ borderLeft: `4px solid ${REASON_META[f.reason].accent}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
                <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)' }}>{i + 1}. {f.title}</p>
                <span style={{ font: '600 12px/1.2 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{people(f.affected)}{f.recoverableMonthlyCents ? ` · ${monthly(f.recoverableMonthlyCents)}` : ''}</span>
              </div>
              <p style={{ margin: '8px 0 0', font: '500 13px/1.5 var(--font-sans)' }}>{f.action}</p>
              <p style={{ margin: '6px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{f.why}</p>
              <button type="button" onClick={() => drill.cases(f.title, f.userIds, REASON_META[f.reason].meaning)} style={{ marginTop: 10, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--surface-card)', color: 'var(--ink-700)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' }}>
                See the {f.affected === 1 ? 'person' : 'people'}
              </button>
            </Card>
          ))}
          {report.fixes.length === 0 && <Card padding="wide"><p style={{ margin: 0, font: '400 13px var(--font-sans)', color: 'var(--text-secondary)' }}>Nothing to fix in this range.</p></Card>}
        </div>
      </div>

      <div>
        <SectionHeading count={report.stripeFeedback.reduce((s, f) => s + f.count, 0)}>What they told Stripe</SectionHeading>
        <Card padding="wide" style={{ paddingTop: 6, paddingBottom: 6 }}>
          {report.stripeFeedback.length > 0 ? (
            <Bars rows={report.stripeFeedback.map(f => ({ key: f.feedback, label: f.label, value: f.count, color: 'var(--violet-500)' }))} />
          ) : (
            <p style={{ margin: 0, padding: '10px 0', font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>No cancel feedback recorded in Stripe yet. Turn on the cancellation survey in the Stripe customer portal to start collecting it.</p>
          )}
          {report.comments.map(c => (
            <div key={c.userId} style={{ borderTop: '1px solid var(--border-subtle)', padding: '10px 0' }}>
              <p style={{ margin: 0, font: '500 13px/1.5 var(--font-sans)', fontStyle: 'italic' }}>&ldquo;{c.comment}&rdquo;</p>
              <p style={{ margin: '2px 0 0', font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>{c.name}{c.feedback ? ` · ${c.feedback.replace(/_/g, ' ')}` : ''}</p>
            </div>
          ))}
        </Card>
      </div>

      {report.warnings.length > 0 && (
        <div>
          <SectionHeading count={report.warnings.length}>Data warnings</SectionHeading>
          <Card padding="wide" style={{ background: 'var(--amber-100)', borderColor: 'var(--amber-200)', paddingTop: 4, paddingBottom: 4 }}>
            {report.warnings.map((w, i) => (
              <button key={w.text} type="button" disabled={w.userIds.length === 0} onClick={() => drill.cases('Data warning', w.userIds, w.text)} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', padding: '8px 0', background: 'none', border: 0, borderTop: i ? '1px solid var(--amber-200)' : 0, textAlign: 'left', cursor: w.userIds.length ? 'pointer' : 'default', color: 'var(--amber-800)', font: '400 12px/1.5 var(--font-sans)' }}>
                <span>{w.text}</span>
                {w.userIds.length > 0 && <span style={{ fontWeight: 600, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{w.userIds.length}</span>}
              </button>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
