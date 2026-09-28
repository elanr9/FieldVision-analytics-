'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Skeleton } from '@/components/ui/Skeleton';
import type { CaseInsight } from '@/lib/conversion/ai';
import type { ChurnCase } from '@/lib/conversion/report';

export interface CaseAiProps {
  item: ChurnCase;
}

const label: React.CSSProperties = { margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', color: 'var(--text-secondary)' };
const body: React.CSSProperties = { margin: '2px 0 0', font: '400 13px/1.5 var(--font-sans)' };

/** The model's read on one athlete, loaded when the case screen opens. */
export function CaseAi({ item }: CaseAiProps) {
  const [insight, setInsight] = useState<CaseInsight | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/churn-case', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ item }) })
      .then(async res => {
        const json = (await res.json()) as CaseInsight | { error: string };
        if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : `Request failed (${res.status})`);
        if (!cancelled) setInsight(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  const copy = () => {
    if (!insight) return;
    navigator.clipboard.writeText(insight.message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div>
      <SectionHeading>AI read</SectionHeading>
      {error && !insight && (
        <Card padding="wide" style={{ background: 'var(--amber-100)', borderColor: 'var(--amber-200)' }}>
          <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--amber-800)' }}>{error.includes('OPENAI_API_KEY') ? 'Add OPENAI_API_KEY to turn this on.' : error}</p>
        </Card>
      )}
      {!error && !insight && (
        <Card padding="wide" style={{ display: 'grid', gap: 8 }}>
          <Skeleton width="90%" />
          <Skeleton width="75%" />
          <Skeleton width="60%" />
        </Card>
      )}
      {insight && (
        <Card padding="wide" style={{ display: 'grid', gap: 12 }}>
          <p style={{ margin: 0, font: '400 14px/1.55 var(--font-sans)' }}>{insight.story}</p>
          <div><p style={label}>Why they left</p><p style={body}>{insight.whyTheyLeft}</p></div>
          <div><p style={label}>When it went wrong</p><p style={body}>{insight.whenItWentWrong}</p></div>
          <div><p style={label}>What to do</p><p style={body}>{insight.whatToDo}</p></div>
          <div style={{ background: 'var(--surface-page)', borderRadius: 'var(--radius-lg)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <p style={label}>Text to send</p>
              <button type="button" onClick={copy} style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', font: '600 11px/1 var(--font-sans)', color: 'var(--ink-600)' }}>{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p style={{ ...body, marginTop: 4 }}>{insight.message}</p>
          </div>
        </Card>
      )}
    </div>
  );
}
