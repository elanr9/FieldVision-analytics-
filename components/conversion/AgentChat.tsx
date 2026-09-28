'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { AgentMessage } from '@/lib/conversion/ai';

export interface AgentChatProps {
  range: string;
}

const STORAGE_KEY = 'inkbound-agent-chat-v1';

const STARTERS = [
  'What should we fix first this week, and why?',
  'Why do people stop at the paywall? What would you change on that screen?',
  'Write the Cursor prompt for the top fix.',
  'We are at $6k ARR. Give me a no budget plan to double trials in 30 days.',
  'Who should I call today and what do I say?',
];

/** Splits a reply into prose and fenced code blocks so prompts get a copy button. */
function segments(text: string): { kind: 'text' | 'code'; body: string }[] {
  const out: { kind: 'text' | 'code'; body: string }[] = [];
  const parts = text.split(/```[a-zA-Z]*\n?/);
  parts.forEach((part, i) => {
    if (!part) return;
    out.push({ kind: i % 2 === 1 ? 'code' : 'text', body: i % 2 === 1 ? part.replace(/\n$/, '') : part.trim() });
  });
  return out;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
      style={{ border: 0, background: 'rgb(255 255 255 / .12)', color: 'var(--text-inverse)', borderRadius: 'var(--radius-full)', padding: '4px 10px', font: '600 11px/1.2 var(--font-sans)', cursor: 'pointer' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Bubble({ message, streaming }: { message: AgentMessage; streaming: boolean }) {
  const mine = message.role === 'user';
  if (mine) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <p style={{ margin: 0, maxWidth: '85%', background: 'var(--action-primary)', color: 'var(--text-inverse)', borderRadius: 18, borderBottomRightRadius: 6, padding: '10px 14px', font: '400 14px/1.5 var(--font-sans)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
      </div>
    );
  }
  const parts = segments(message.content);
  return (
    <div style={{ display: 'grid', gap: 8, maxWidth: '95%' }}>
      {parts.length === 0 && streaming && <p style={{ margin: 0, font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>Thinking…</p>}
      {parts.map((p, i) =>
        p.kind === 'code' ? (
          <div key={i} style={{ background: 'var(--surface-inverse)', color: 'var(--text-inverse)', borderRadius: 'var(--radius-lg)', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', opacity: 0.7 }}>Prompt</span>
              <CopyButton text={p.body} />
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', font: '400 12px/1.6 var(--font-mono, ui-monospace, monospace)' }}>{p.body}</pre>
          </div>
        ) : (
          <div key={i} style={{ background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 18, borderBottomLeftRadius: 6, padding: '10px 14px', font: '400 14px/1.55 var(--font-sans)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {p.body}
            {streaming && i === parts.length - 1 && <span style={{ display: 'inline-block', width: 6, height: 14, marginLeft: 2, verticalAlign: 'text-bottom', background: 'var(--text-primary)', animation: 'ink-pulse 1s steps(2) infinite' }} />}
          </div>
        ),
      )}
    </div>
  );
}

/** Back and forth with the product and GTM agent, grounded in the same data as the diagnosis. */
export function AgentChat({ range }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as AgentMessage[]);
    } catch {
      // Nothing saved yet.
    }
  }, []);

  useEffect(() => {
    if (messages.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    setDraft('');
    const history: AgentMessage[] = [...messages, { role: 'user', content }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/conversion-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history, range }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: 'assistant', content: reply }]);
      }
      if (!reply.trim()) throw new Error('The agent returned nothing. Try again.');
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages(history);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const clear = () => {
    stop();
    setMessages([]);
    setError(null);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Card padding="wide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)' }}>Product and GTM agent</p>
          <p style={{ margin: '2px 0 0', font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>Knows every trial, every cancel, the onboarding funnel and Stripe. Ask for a diagnosis, a plan, a message, or a Cursor prompt.</p>
        </div>
        {messages.length > 0 && <button type="button" onClick={clear} style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '6px 12px', background: 'var(--surface-card)', color: 'var(--text-secondary)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer', whiteSpace: 'nowrap' }}>New chat</button>}
      </Card>

      {messages.length === 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {STARTERS.map(s => (
            <button key={s} type="button" onClick={() => send(s)} style={{ textAlign: 'left', border: '1px solid var(--border-default)', borderRadius: 14, padding: '10px 14px', background: 'var(--surface-card)', color: 'var(--text-primary)', font: '500 13px/1.4 var(--font-sans)', cursor: 'pointer' }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        {messages.map((m, i) => <Bubble key={i} message={m} streaming={streaming && i === messages.length - 1 && m.role === 'assistant'} />)}
        <div ref={bottomRef} />
      </div>

      {error && <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--red-600)' }}>{error.includes('OPENAI_API_KEY') ? 'Add OPENAI_API_KEY to turn the agent on.' : error}</p>}

      <form
        onSubmit={e => {
          e.preventDefault();
          send(draft);
        }}
        style={{ position: 'sticky', bottom: 'calc(var(--safe-bottom) + 8px)', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--surface-page)', paddingTop: 4 }}
      >
        <textarea
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={Math.min(5, Math.max(1, draft.split('\n').length))}
          placeholder="Ask anything about churn, product, or growth…"
          style={{ flex: 1, resize: 'none', border: '1px solid var(--border-input)', borderRadius: 18, padding: '11px 14px', font: '400 14px/1.4 var(--font-sans)', background: 'var(--surface-card)', color: 'var(--text-primary)', outline: 'none' }}
        />
        {streaming ? (
          <button type="button" onClick={stop} style={{ border: 0, borderRadius: 'var(--radius-full)', minWidth: 64, height: 44, background: 'var(--gray-200)', color: 'var(--text-primary)', font: '600 13px/1 var(--font-sans)', cursor: 'pointer' }}>Stop</button>
        ) : (
          <button type="submit" disabled={!draft.trim()} style={{ border: 0, borderRadius: 'var(--radius-full)', minWidth: 64, height: 44, background: draft.trim() ? 'var(--action-primary)' : 'var(--gray-200)', color: draft.trim() ? 'var(--text-inverse)' : 'var(--text-tertiary)', font: '600 13px/1 var(--font-sans)', cursor: draft.trim() ? 'pointer' : 'default' }}>Send</button>
        )}
      </form>
    </div>
  );
}
