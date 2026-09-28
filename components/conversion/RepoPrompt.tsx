'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ChurnFix, ChurnProblem, RepoPrompt as RepoPromptResult } from '@/lib/conversion/ai';

export interface RepoPromptProps {
  fix: ChurnFix;
  problems: ChurnProblem[];
  range: string;
}

const REPO_LABEL: Record<RepoPromptResult['repo'], string> = {
  'inkbound-web': 'Paste into inkbound-web',
  'inkbound-mobile': 'Paste into inkbound-mobile',
  both: 'Paste into inkbound-web, then inkbound-mobile',
  supabase: 'Paste into inkbound-web (supabase folder)',
};

const button: React.CSSProperties = { border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--surface-card)', color: 'var(--ink-700)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' };

/** Generates and shows a paste ready Cursor prompt for one fix. */
export function RepoPrompt({ fix, problems, range }: RepoPromptProps) {
  const [result, setResult] = useState<RepoPromptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const generate = (refresh = false) => {
    setLoading(true);
    setError(null);
    setOpen(true);
    fetch('/api/fix-prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fix, problems, range, refresh }) })
      .then(async res => {
        const json = (await res.json()) as RepoPromptResult | { error: string };
        if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : `Request failed (${res.status})`);
        setResult(json);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };

  const copy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {!result && !loading && <button type="button" onClick={() => generate()} style={{ ...button, background: 'var(--action-primary)', color: 'var(--text-inverse)', borderColor: 'var(--action-primary)' }}>Write the repo prompt</button>}
        {result && (
          <>
            <button type="button" onClick={() => setOpen(o => !o)} style={button}>{open ? 'Hide prompt' : 'Show prompt'}</button>
            <button type="button" onClick={copy} style={{ ...button, background: 'var(--action-primary)', color: 'var(--text-inverse)', borderColor: 'var(--action-primary)' }}>{copied ? 'Copied' : 'Copy prompt'}</button>
            <button type="button" onClick={() => generate(true)} disabled={loading} style={button}>{loading ? 'Rewriting…' : 'Rewrite'}</button>
          </>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 10, background: 'var(--surface-inverse)', color: 'var(--text-inverse)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
          {loading && !result && <div style={{ display: 'grid', gap: 8 }}><Skeleton width="80%" tone="info" /><Skeleton width="95%" tone="info" /><Skeleton width="70%" tone="info" /></div>}
          {error && <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--amber-200)' }}>{error}</p>}
          {result && (
            <>
              <p style={{ margin: '0 0 8px', font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', opacity: 0.7 }}>{REPO_LABEL[result.repo]}</p>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', font: '400 12px/1.6 var(--font-mono, ui-monospace, monospace)', maxHeight: 420, overflow: 'auto' }}>{result.prompt}</pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}
