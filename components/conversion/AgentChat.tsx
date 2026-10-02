'use client';

import { useEffect, useRef, useState } from 'react';
import type { AgentMessage } from '@/lib/conversion/ai';
import { Markdown } from './Markdown';

export interface AgentSeed {
  text: string;
  /** Changes on every ask so the same question can be asked twice */
  nonce: number;
}

export interface AgentChatProps {
  range: string;
  /** A question handed over from another view; sent as soon as the chat mounts or the nonce changes */
  seed?: AgentSeed | null;
}

const STORAGE_KEY = 'inkbound-agent-chat-v1';

const STARTERS = [
  'What should we fix first this week, and why?',
  'Why do people stop at the paywall? What would you change on that screen?',
  'Write the Cursor prompt for the top fix.',
  'Give me a no budget plan to double trials in 30 days.',
  'Who should I call today and what do I say?',
];

const KEYFRAMES = `
@keyframes ink-msg-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes ink-dot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-4px);opacity:1}}
`;

function Dots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', height: 20, padding: '0 2px' }} aria-label="Thinking">
      {[0, 1, 2].map(i => <span key={i} style={{ width: 7, height: 7, borderRadius: 7, background: 'var(--text-secondary)', animation: `ink-dot 1.2s ease-in-out ${i * 0.15}s infinite` }} />)}
    </span>
  );
}

function Bubble({ message, streaming }: { message: AgentMessage; streaming: boolean }) {
  if (message.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'ink-msg-in 220ms var(--ease-out) both' }}>
        <p style={{ margin: 0, maxWidth: '82%', background: 'var(--action-primary)', color: 'var(--text-inverse)', borderRadius: 20, borderBottomRightRadius: 6, padding: '10px 14px', font: '400 15px/1.45 var(--font-sans)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</p>
      </div>
    );
  }
  const empty = !message.content.trim();
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', animation: 'ink-msg-in 220ms var(--ease-out) both' }}>
      <img src="/inkbound-mark.png" alt="" width={22} height={22} style={{ flexShrink: 0, marginTop: 6, opacity: 0.9 }} />
      <div style={{ minWidth: 0, flex: 1, background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 20, borderTopLeftRadius: 6, padding: empty ? '10px 14px' : '12px 14px' }}>
        {empty ? <Dots /> : <Markdown text={message.content} />}
        {!empty && streaming && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 8, marginTop: 6, background: 'var(--ink-500)', animation: 'ink-pulse 1s ease-in-out infinite' }} />}
      </div>
    </div>
  );
}

/** Back and forth with the product and GTM agent, grounded in the same data as the diagnosis. */
export function AgentChat({ range, seed = null }: AgentChatProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const seenSeed = useRef<number | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as AgentMessage[]);
    } catch {
      // Nothing saved yet.
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (messages.length) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    else window.localStorage.removeItem(STORAGE_KEY);
  }, [messages, loaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: streaming ? 'auto' : 'smooth' });
  }, [messages, streaming]);

  const send = async (text: string, base: AgentMessage[] = messages) => {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    setDraft('');
    const history: AgentMessage[] = [...base, { role: 'user', content }];
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
      let pending = '';
      let frame = 0;
      const flush = () => {
        frame = 0;
        setMessages([...history, { role: 'assistant', content: reply }]);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        pending = decoder.decode(value, { stream: true });
        reply += pending;
        // One state update per animation frame keeps long replies smooth instead of re rendering per token.
        if (!frame) frame = requestAnimationFrame(flush);
      }
      if (frame) cancelAnimationFrame(frame);
      flush();
      if (!reply.trim()) throw new Error('The agent returned nothing. Try again.');
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
        setMessages(history);
      } else {
        setMessages(m => (m[m.length - 1]?.content.trim() ? m : history));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  useEffect(() => {
    if (!loaded || !seed || seenSeed.current === seed.nonce) return;
    seenSeed.current = seed.nonce;
    void send(seed.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, loaded]);

  const stop = () => abortRef.current?.abort();
  const clear = () => {
    stop();
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  };

  const canSend = draft.trim().length > 0 && !streaming;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <style>{KEYFRAMES}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, font: '700 15px/1.3 var(--font-sans)' }}>Product and GTM agent</p>
          <p style={{ margin: '2px 0 0', font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>Knows every trial, cancel, screen and Stripe record. Ask for a diagnosis, a plan, a message, or a Cursor prompt.</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={clear} style={{ flexShrink: 0, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-full)', padding: '7px 12px', background: 'var(--surface-card)', color: 'var(--text-secondary)', font: '600 12px/1.2 var(--font-sans)', cursor: 'pointer' }}>New chat</button>
        )}
      </div>

      {loaded && messages.length === 0 && (
        <div style={{ display: 'grid', gap: 6 }}>
          {STARTERS.map((s, i) => (
            <button key={s} type="button" onClick={() => void send(s)} style={{ textAlign: 'left', border: '1px solid var(--border-default)', borderRadius: 14, padding: '11px 14px', background: 'var(--surface-card)', color: 'var(--text-primary)', font: '500 13px/1.4 var(--font-sans)', cursor: 'pointer', animation: `ink-msg-in 260ms var(--ease-out) ${i * 40}ms both` }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14, paddingBottom: 8 }}>
        {messages.map((m, i) => <Bubble key={i} message={m} streaming={streaming && i === messages.length - 1 && m.role === 'assistant'} />)}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      {error && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'var(--amber-100)', border: '1px solid var(--amber-200)', borderRadius: 12, padding: '8px 12px' }}>
          <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--amber-800)' }}>{error.includes('OPENAI_API_KEY') ? 'Add OPENAI_API_KEY to turn the agent on.' : error}</p>
          <button type="button" onClick={() => { const last = [...messages].reverse().find(m => m.role === 'user'); if (last) void send(last.content, messages.slice(0, messages.lastIndexOf(last))); }} style={{ border: 0, background: 'none', padding: 0, font: '600 12px/1 var(--font-sans)', color: 'var(--amber-800)', cursor: 'pointer', whiteSpace: 'nowrap' }}>Retry</button>
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          void send(draft);
        }}
        style={{ position: 'sticky', bottom: 'calc(var(--safe-bottom) + 8px)', zIndex: 5, display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--surface-card)', border: '1px solid var(--border-default)', borderRadius: 24, padding: 6, boxShadow: 'var(--shadow-sm)' }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={Math.min(5, Math.max(1, draft.split('\n').length))}
          placeholder="Ask about churn, the product, or growth…"
          style={{ flex: 1, resize: 'none', border: 0, outline: 'none', borderRadius: 18, padding: '10px 12px', font: '400 16px/1.4 var(--font-sans)', background: 'transparent', color: 'var(--text-primary)' }}
        />
        {streaming ? (
          <button type="button" onClick={stop} aria-label="Stop" style={{ flexShrink: 0, border: 0, borderRadius: 'var(--radius-full)', width: 40, height: 40, background: 'var(--gray-200)', color: 'var(--text-primary)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--text-primary)' }} />
          </button>
        ) : (
          <button type="submit" disabled={!canSend} aria-label="Send" style={{ flexShrink: 0, border: 0, borderRadius: 'var(--radius-full)', width: 40, height: 40, background: canSend ? 'var(--action-primary)' : 'var(--gray-200)', color: canSend ? 'var(--text-inverse)' : 'var(--text-tertiary)', cursor: canSend ? 'pointer' : 'default', display: 'grid', placeItems: 'center', transition: 'background-color var(--duration-fast)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </form>
    </div>
  );
}
