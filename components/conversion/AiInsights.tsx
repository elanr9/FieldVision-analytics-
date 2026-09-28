'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ChurnInsights } from '@/lib/conversion/ai';
import type { Drill } from './ConversionTab';
import { RepoPrompt } from './RepoPrompt';

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

const askButton: React.CSSProperties = { border: 0, borderRadius: 'var(--radius-full)', padding: '7px 13px', background: 'var(--action-primary)', color: 'var(--text-inverse)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' };
const ghostButton: React.CSSProperties = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--surface-card)', color: 'var(--ink-700)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' };

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
      <p style={{ margin: '4px 0 0', font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>Reading every trial and every Stripe record. Takes about half a minute the first time, then it is saved until the data changes.</p>
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
          {loading ? 'Rerunning…' : 'Rerun'}
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
          <p style={{ margin: '8px 0 0', font: '400 10px/1.4 var(--font-sans)', opacity: 0.6 }}>Written {new Date(insights.generatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · reused until the data changes</p>
        </Card>
        {insights.stale && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8, background: 'var(--amber-100)', border: '1px solid var(--amber-200)', borderRadius: 12, padding: '8px 12px' }}>
            <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--amber-800)' }}>New trials or cancels landed since this was written.</p>
            <button type="button" onClick={refresh} disabled={loading} style={{ border: 0, background: 'none', padding: 0, font: '600 12px/1 var(--font-sans)', color: 'var(--amber-800)', cursor: 'pointer', whiteSpace: 'nowrap' }}>{loading ? 'Rerunning…' : 'Rerun now'}</button>
          </div>
        )}
        <p style={{ margin: '8px 2px 0', font: '400 11px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>Problems are ranked by how many people and how much money they cost. Tap Ask the agent on any card to dig into it, push back, or get a prompt.</p>
      </div>

      <div>
        <SectionHeading count={insights.problems.length}>Problems, biggest first</SectionHeading>
        <div style={{ display: 'grid', gap: 10 }}>
          {insights.problems.map((p, i) => (
            <Card key={i} padding="wide" style={{ borderLeft: `4px solid ${SEVERITY[p.severity]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)' }}>{p.title}</p>
                <span style={pill}>{p.when}</span>
              </div>
              <p style={{ margin: '8px 0 0', font: '400 13px/1.5 var(--font-sans)' }}>{p.why}</p>
              {p.evidence.length > 0 && (
                <ul style={{ margin: '8px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 3 }}>
                  {p.evidence.map((ev, j) => <li key={j} style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)', paddingLeft: 12, position: 'relative' }}><span style={{ position: 'absolute', left: 0 }}>·</span>{ev}</li>)}
                </ul>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                <button type="button" onClick={() => drill.ask(`Let's talk about "${p.title}" (${p.when}). Explain what is really happening here using the data, why these ${p.userIds.length} athletes specifically, and exactly what you would change first.`)} style={askButton}>Ask the agent</button>
                {p.userIds.length > 0 && (
                  <button type="button" onClick={() => drill.cases(p.title, p.userIds, p.why)} style={ghostButton}>
                    {p.userIds.length} {p.userIds.length === 1 ? 'person' : 'people'}
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <SectionHeading count={insights.fixes.length}>Fixes, best return first</SectionHeading>
        <div style={{ display: 'grid', gap: 10 }}>
          {insights.fixes.map((f, i) => (
            <Card key={i} padding="wide">
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
              <div style={{ marginTop: 10 }}>
                <button type="button" onClick={() => drill.ask(`Let's talk about the fix "${f.title}" at ${f.where}. Is this the right call given the data? What would you change about it, what could go wrong, and how do we measure it worked?`)} style={askButton}>Ask the agent</button>
              </div>
              <RepoPrompt fix={f} problems={insights.problems} range={range} />
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
