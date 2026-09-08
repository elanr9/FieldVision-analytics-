'use client';

import { useState } from 'react';
import { usePager, type Screen } from '@/components/motion';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Mini } from '@/components/overview/Mini';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { PeopleScreen } from '@/components/people/PeopleScreen';
import type { Funnel, FunnelChapterKey, FunnelStep } from '@/lib/funnel';
import type { UserRecord } from '@/lib/types';
import { sharePct } from './format';

type Range = '7d' | '30d' | 'all';

const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, all: Infinity };
const RANGE_CAPTION: Record<Range, string> = { '7d': 'last 7d', '30d': 'last 30d', all: 'all time' };
const RANGE_OPTIONS: [Range, string][] = [['7d', '7d'], ['30d', '30d'], ['all', 'All']];

/**
 * Rows per page for the open chapter. The mock asked for 8, but at 393×852 the card has room for the open
 * chapter's header plus 7 step rows and the pager footer, so the other chapters hide while one is open.
 */
const STEPS_PER_PAGE = 7;

export interface StepsViewProps {
  funnel: Funnel;
  users: UserRecord[];
  push: (s: Screen) => void;
  onStep: (id: string) => void;
}

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 86400000;
}

const TILE_BUTTON = { padding: 0, border: 0, background: 'none', textAlign: 'left', cursor: 'pointer', minWidth: 0, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' } as const;

function StepRow({ step, onClick }: { step: FunnelStep; onClick: () => void }) {
  const dropped = step.dropped ?? 0;
  return (
    <button type="button" onClick={onClick} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px', alignItems: 'center', gap: 10, width: '100%', padding: '8px 16px 8px 24px', background: 'transparent', border: 0, borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      <span style={{ minWidth: 0 }}><span style={{ display: 'block', font: '500 13px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{step.label}</span><span style={{ display: 'block', font: '400 10px/1.4 var(--font-mono)', color: 'var(--text-tertiary)' }}>{step.id}</span></span>
      <span style={{ textAlign: 'right', font: '600 13px/1.4 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{step.pct === null ? '—' : step.pct + '%'}</span>
      <span style={{ textAlign: 'right', font: '500 12px/1.4 var(--font-sans)', fontVariantNumeric: 'tabular-nums', color: dropped > 10 ? 'var(--amber-800)' : 'var(--text-tertiary)' }}>{dropped ? '−' + dropped : ''}</span>
    </button>
  );
}

export function StepsView({ funnel, users, push, onStep }: StepsViewProps) {
  const [range, setRange] = useState<Range>('30d');
  const [openChapter, setOpenChapter] = useState<FunnelChapterKey | null>(null);
  const open = openChapter ? funnel.chapters.find(c => c.key === openChapter) ?? null : null;
  const pager = usePager(open?.steps ?? [], STEPS_PER_PAGE);

  const cohort = users.filter(u => daysSince(u.signupDate) < RANGE_DAYS[range]);
  const started = cohort.filter(u => u.onboarding !== 'none');
  const completed = cohort.filter(u => u.onboarding === 'completed');
  const inProgress = cohort.filter(u => u.onboarding === 'in_progress');
  const caption = RANGE_CAPTION[range];
  const people = (title: string, list: UserRecord[]) => push({ key: 'people-' + title, node: <PeopleScreen title={title + ' · ' + caption} users={list} /> });

  const toggle = (key: FunnelChapterKey) => {
    setOpenChapter(key === openChapter ? null : key);
    pager.setPage(0);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><SectionHeading style={{ marginBottom: 0 }}>Signups · {caption}</SectionHeading><MiniToggle value={range} onChange={setRange} options={RANGE_OPTIONS} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
          <button type="button" style={TILE_BUTTON} onClick={() => people('Started onboarding', started)}><Mini label="Started" value={started.length} sub={cohort.length - started.length + ' never started'} /></button>
          <button type="button" style={TILE_BUTTON} onClick={() => people('Completed onboarding', completed)}><Mini label="Completed" value={completed.length} sub={sharePct(completed.length, started.length) + ' of started'} /></button>
          <button type="button" style={TILE_BUTTON} onClick={() => people('Stuck in onboarding', inProgress)}><Mini label="Stuck" value={inProgress.length} sub="in progress" /></button>
        </div>
      </div>
      <Card padding="none">
        {funnel.chapters.map((ch, ci) => {
          const isOpen = ch.key === openChapter;
          if (openChapter && !isOpen) return null;
          const keep = ch.enter ? Math.round((ch.exit / ch.enter) * 100) : 0;
          return (
            <div key={ch.key} style={{ borderTop: ci && !isOpen ? '1px solid var(--border-subtle)' : 0 }}>
              <button type="button" onClick={() => toggle(ch.key)} style={{ display: 'grid', gridTemplateColumns: '1fr auto 16px', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
                <span><span style={{ display: 'block', font: '600 14px/1.4 var(--font-sans)' }}>{ch.label} <span style={{ font: '400 12px var(--font-sans)', color: 'var(--text-tertiary)' }}>· {ch.steps.length} steps</span></span><span style={{ display: 'block', marginTop: 6, height: 6, borderRadius: 3, background: 'var(--surface-track)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: keep + '%', background: ch.key === 'paywall' ? 'var(--green-600)' : 'var(--ink-700)', borderRadius: 3, transformOrigin: '0 0', animation: 'ink-grow-x 600ms var(--ease-out) both' }} /></span></span>
                <span style={{ textAlign: 'right' }}><span style={{ display: 'block', font: '700 16px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{keep}%</span><span style={{ font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>{ch.enter} → {ch.exit}</span></span>
                <span style={{ color: 'var(--text-tertiary)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform var(--duration-base) var(--ease-out)', fontSize: 18, lineHeight: 1 }}>›</span>
              </button>
              {isOpen && <div key={pager.page} style={{ animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>{pager.slice.map(st => <StepRow key={st.id} step={st} onClick={() => onStep(st.id)} />)}{pager.footer}</div>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
