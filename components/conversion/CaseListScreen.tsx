'use client';

import { usePager } from '@/components/motion';
import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { OUTCOME_LABEL } from '@/lib/conversion/lifecycle';
import { REASON_META } from '@/lib/conversion/reasons';
import type { ChurnCase } from '@/lib/conversion/report';
import { ChurnCaseScreen } from './ChurnCaseScreen';
import { shortDate } from './format';

export interface CaseListScreenProps {
  title: string;
  /** One line under the title explaining the group */
  hint?: string;
  cases: ChurnCase[];
}

function subtitle(c: ChurnCase): string {
  const l = c.lifecycle;
  const bits = [l.planLabel, l.engagement.emailsSent ? `${l.engagement.emailsSent} emails` : null, l.daysToCancel !== null ? `canceled day ${Math.max(1, Math.ceil(l.daysToCancel))}` : null].filter(Boolean);
  return bits.length ? bits.join(' · ') : OUTCOME_LABEL[l.outcome];
}

export function CaseListScreen({ title, hint, cases }: CaseListScreenProps) {
  const { pop, push } = useNav();
  const sorted = [...cases].sort((a, b) => (b.lifecycle.trialStartAt ?? b.lifecycle.signupAt).localeCompare(a.lifecycle.trialStartAt ?? a.lifecycle.signupAt));
  const pager = usePager(sorted, 8);
  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
      <SubHeader title={title} onBack={pop} />
      <div style={{ paddingTop: 16 }}>
        <Card padding="none">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-default)' }}>
            <p style={{ margin: 0, font: '600 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{title} · {cases.length}</p>
            {hint && <p style={{ margin: '2px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>{hint}</p>}
          </div>
          {pager.slice.map((c, i) => {
            const accent = c.verdict ? REASON_META[c.verdict.reason].accent : 'var(--green-500)';
            return (
              <button key={c.lifecycle.userId} type="button" onClick={() => push({ key: 'case-' + c.lifecycle.userId, node: <ChurnCaseScreen item={c} /> })} style={{ display: 'grid', gridTemplateColumns: '4px 1fr auto', gap: 12, alignItems: 'center', width: '100%', padding: '12px 16px', background: 'none', border: 0, borderTop: i ? '1px solid var(--border-subtle)' : 0, textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
                <span style={{ width: 4, height: 36, borderRadius: 2, background: accent }} />
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, font: '500 14px/1.5 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.lifecycle.name}</p>
                  <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.verdict ? REASON_META[c.verdict.reason].title : OUTCOME_LABEL[c.lifecycle.outcome]} · {subtitle(c)}</p>
                </div>
                <span style={{ font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{shortDate(c.lifecycle.trialStartAt ?? c.lifecycle.signupAt)}</span>
              </button>
            );
          })}
          {!cases.length && <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', font: '400 14px var(--font-sans)', color: 'var(--text-secondary)' }}>No one in this group.</p>}
          {pager.footer}
        </Card>
      </div>
    </main>
  );
}
