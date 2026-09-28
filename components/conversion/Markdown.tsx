'use client';

import { Fragment, useState, type ReactNode } from 'react';

/** Renders the subset of markdown the agent actually writes: paragraphs, headings, lists, bold, inline code, fenced code. */

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let i = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > last) out.push(<Fragment key={keyBase + i++}>{text.slice(last, start)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith('**')) out.push(<strong key={keyBase + i++} style={{ fontWeight: 600 }}>{tok.slice(2, -2)}</strong>);
    else out.push(<code key={keyBase + i++} style={{ font: '500 12.5px/1.4 var(--font-mono, ui-monospace, monospace)', background: 'var(--gray-100)', borderRadius: 4, padding: '1px 5px' }}>{tok.slice(1, -1)}</code>);
    last = start + tok.length;
  }
  if (last < text.length) out.push(<Fragment key={keyBase + i++}>{text.slice(last)}</Fragment>);
  return out;
}

export function CopyButton({ text, dark = true }: { text: string; dark?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-live="polite"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
      style={{ border: 0, background: dark ? 'rgb(255 255 255 / .14)' : 'var(--gray-100)', color: dark ? 'var(--text-inverse)' : 'var(--text-primary)', borderRadius: 'var(--radius-full)', padding: '5px 11px', font: '600 11px/1.2 var(--font-sans)', cursor: 'pointer', transition: 'background-color var(--duration-fast)' }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function CodeBlock({ code, label = 'Prompt' }: { code: string; label?: string }) {
  return (
    <div style={{ background: 'var(--surface-inverse)', color: 'var(--text-inverse)', borderRadius: 14, padding: '10px 12px 12px', margin: '2px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wide)', opacity: 0.65 }}>{label}</span>
        <CopyButton text={code} />
      </div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', font: '400 12.5px/1.6 var(--font-mono, ui-monospace, monospace)' }}>{code}</pre>
    </div>
  );
}

type Block = { kind: 'p'; text: string } | { kind: 'h'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'ol'; items: string[] } | { kind: 'code'; code: string; lang: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r/g, '').split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push({ kind: 'code', code: buf.join('\n'), lang });
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^#{1,4}\s/.test(line)) {
      blocks.push({ kind: 'h', text: line.replace(/^#{1,4}\s+/, '') });
      i++;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*•]\s+/, ''));
      blocks.push({ kind: 'ul', items });
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ''));
      blocks.push({ kind: 'ol', items });
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('```') && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*•]\s+/.test(lines[i]) && !/^\s*\d+[.)]\s+/.test(lines[i])) buf.push(lines[i++]);
    blocks.push({ kind: 'p', text: buf.join(' ') });
  }
  return blocks;
}

const listStyle: React.CSSProperties = { margin: 0, paddingLeft: 20, display: 'grid', gap: 4 };

export function Markdown({ text }: { text: string }) {
  const blocks = parse(text);
  return (
    <div style={{ display: 'grid', gap: 10, font: '400 14px/1.6 var(--font-sans)', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
      {blocks.map((b, i) => {
        if (b.kind === 'code') return <CodeBlock key={i} code={b.code} label={b.lang || 'Prompt'} />;
        if (b.kind === 'h') return <p key={i} style={{ margin: 0, font: '700 14px/1.4 var(--font-sans)' }}>{inline(b.text, `h${i}`)}</p>;
        if (b.kind === 'ul') return <ul key={i} style={listStyle}>{b.items.map((it, j) => <li key={j}>{inline(it, `u${i}${j}`)}</li>)}</ul>;
        if (b.kind === 'ol') return <ol key={i} style={listStyle}>{b.items.map((it, j) => <li key={j}>{inline(it, `o${i}${j}`)}</li>)}</ol>;
        return <p key={i} style={{ margin: 0 }}>{inline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
