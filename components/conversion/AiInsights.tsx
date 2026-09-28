'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ChurnInsights } from '@/lib/conversion/ai';
import type { Drill } from './ConversionTab';

export interface AiInsightsProps {
  /** 30, 90 or all, matches the tab's range toggle */
  range: string;
  drill: Drill;
}

const SEVERITY: Record<ChurnInsights['problems'][number]['severity'], string> = {
  high: 'var(--red-500)',
  medium: 'var(--amber-500)',
  low: 'var(--gray-300)',
};

const EFFORT: Record<ChurnInsights['fixes'][number]['effort'], string> = {
  small: 'Small build',
  medium: 'Medium build',
  large: 'Big build',
};

const pill: React.CSSProperties = { display: 'inline-flex', borderRadius: 'var(--radius-full)', padding: '2px 8px', font: '600 10px/1.5 var(--font-sans)', background: 'var(--gray-100)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' };

export function useChurnInsights(range: string): { insights: ChurnInsights | null; loading: boolean; error: string | null; refresh: () => void } {
  const [insights, setInsights] = useState<ChurnInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/conversion-insights?range=${encodeURIComponent(range)}${nonce ? '&refresh=1' : ''}`)
      .then(async res => {
        const json = (await res.json()) as ChurnInsights | { error: string };
        if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : `Request failed (${res.status})`);
        if (!cancelled) setInsights(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, nonce]);

  return { insights, loading, error, refresh: () => setNonce(n => n + 1) };
}

function Loading() {
  return (
    <Card padding="wide" style={{ display: 'grid', gap: 10 }}>
      <Skeleton width="70%" height={16} />
      <Skeleton width="95%" />
      <Skeleton width="88%" />
      <Skeleton width="60%" />
      <p style={{ margin: '4px 0 0', font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>Reading every trial and every Stripe record. This takes about half a minute the first time.</p>
    </Card>
  );
}

export function AiInsights({ range, drill }: AiInsightsProps) {
  const { insights, loading, error, refresh } = useChurnInsights(range);

  const heading = (
    <SectionHeading>
      AI diagnosis
      {insights && (
        <button type="button" onClick={refresh} disabled={loading} style={{ marginLeft: 10, border: 0, background: 'none', padding: 0, cursor: loading ? 'default' : 'pointer', font: '600 11px/1 var(--font-sans)', color: 'var(--ink-600)', textTransform: 'none', letterSpacing: 0 }}>
          {loading ? 'Thinking…' : 'Rerun'}
        </button>
      )}
    </SectionHeading>
  );

  if (loading && !insights) return <div>{heading}<Loading /></div>;
  if (error && !insights) {
    return (
      <div>
        {heading}
        <Card padding="wide" style={{ background: 'var(--amber-100)', borderColor: 'var(--amber-200)' }}>
          <p style={{ margin: 0, font: '500 13px/1.5 var(--font-sans)', color: 'var(--amber-800)' }}>{error.includes('OPENAI_API_KEY') ? 'Add OPENAI_API_KEY to the environment to turn on the AI diagnosis.' : error}</p>
          {!error.includes('OPENAI_API_KEY') && <button type="button" onClick={refresh} style={{ marginTop: 8, border: '1px solid var(--amber-200)', borderRadius: 'var(--radius-full)', padding: '5px 10px', background: 'var(--surface-card)', color: 'var(--amber-800)', font: '600 11px/1.2 var(--font-sans)', cursor: 'pointer' }}>Try again</button>}
        </Card>
      </div>
    );
  }
  if (!insights) return null;

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        {heading}
        <Card padding="wide" style={{ background: 'var(--surface-inverse)', color: 'var(--text-inverse)', border: 0 }}>
          <p style={{ margin: 0, font: '600 16px/1.4 var(--font-sans)', letterSpacing: '-0.01em' }}>{insights.headline}</p>
          <p style={{ margin: '8px 0 0', font: '400 10px/1.4 var(--font-sans)', opacity: 0.6 }}>{insights.model} · {new Date(insights.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
        </Card>
      </div>

      <div>
        <SectionHeading count={insights.problems.length}>Problems, biggest first</SectionHeading>
        <div style={{ display: 'grid', gap: 10 }}>
          {insights.problems.map(p => (
            <Card key={p.title} padding="wide" style={{ borderLeft: `4px solid ${SEVERITY[p.severity]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)' }}>{p.title}</p>
                <span style={pill}>{p.when}</span>
              </div>
              <p style={{ margin: '8px 0 0', font: '400 13px/1.5 var(--font-sans)' }}>{p.why}</p>
              {p.evidence.length > 0 && (
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                  {p.evidence.map(ev => <li key={ev} style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)', paddingLeft: 12, position: 'relative' }}><span style={{ position: 'absolute', left: 0 }}>·</span>{ev}</li>)}
                </ul>
              )}
              {p.userIds.length > 0 && (
                <button type="button" onClick={() => drill.cases(p.title, p.userIds, p.why)} style={{ marginTop: 10, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--surface-card)', color: 'var(--ink-700)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' }}>
                  See the {p.userIds.length} {p.userIds.length === 1 ? 'person' : 'people'}
                </button>
              )}
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading count={insights.fixes.length}>Fixes, best return first</SectionHeading>
        <div style={{ display: 'grid', gap: 10 }}>
          {insights.fixes.map((f, i) => (
            <Card key={f.title} padding="wide">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)' }}>{i + 1}. {f.title}</p>
                <span style={pill}>{EFFORT[f.effort]}</span>
              </div>
              <p style={{ margin: '4px 0 0', font: '600 11px/1.4 var(--font-sans)', color: 'var(--ink-600)', fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>{f.where}</p>
              <p style={{ margin: '8px 0 0', font: '500 13px/1.5 var(--font-sans)' }}>{f.action}</p>
              <p style={{ margin: '6px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{f.why}</p>
              <p style={{ margin: '6px 0 0', font: '600 12px/1.5 var(--font-sans)', color: 'var(--green-600)' }}>{f.impact}</p>
              {f.steps.length > 0 && (
                <ol style={{ margin: '10px 0 0', padding: '10px 12px', listStyle: 'none', display: 'grid', gap: 6, background: 'var(--surface-page)', borderRadius: 'var(--radius-lg)' }}>
                  {f.steps.map((s, j) => (
                    <li key={s} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 8, font: '400 12px/1.5 var(--font-sans)' }}>
                      <span style={{ width: 16, height: 16, marginTop: 1, borderRadius: 4, border: '1.5px solid var(--border-strong)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '700 9px/1 var(--font-sans)', color: 'var(--text-tertiary)' }}>{j + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              )}
              {f.problems.length > 0 && <p style={{ margin: '6px 0 0', font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>Fixes: {f.problems.join(', ')}</p>}
            </Card>
          ))}
        </div>
      </div>

      {insights.questionsToAsk.length > 0 && (
        <div>
          <SectionHeading>Ask them on the call</SectionHeading>
          <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {insights.questionsToAsk.map((q, i) => <p key={q} style={{ margin: 0, padding: '8px 0', borderTop: i ? '1px solid var(--border-subtle)' : 0, font: '400 13px/1.5 var(--font-sans)' }}>{q}</p>)}
          </Card>
        </div>
      )}
    </div>
  );
}
