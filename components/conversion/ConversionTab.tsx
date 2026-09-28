'use client';

import { useEffect, useMemo, useState } from 'react';
import { Fade, type Screen } from '@/components/motion';
import { PeopleScreen } from '@/components/people/PeopleScreen';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { buildConversionReport, type ChurnCase, type ConversionData } from '@/lib/conversion/report';
import { rangeForDays } from '@/lib/funnel';
import type { UserRecord } from '@/lib/types';
import { AgentChat, type AgentSeed } from './AgentChat';
import { CaseListScreen } from './CaseListScreen';
import { FixView } from './FixView';
import { PatternsView } from './PatternsView';
import { WhyView } from './WhyView';

type View = 'why' | 'patterns' | 'fix' | 'agent';
type Range = '30' | '90' | 'all';

const VIEWS: { key: View; label: string }[] = [
  { key: 'why', label: 'Why they leave' },
  { key: 'patterns', label: 'Patterns' },
  { key: 'fix', label: 'Fix plan' },
  { key: 'agent', label: 'Agent' },
];

const RANGES: { key: Range; label: string }[] = [
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: 'all', label: 'All time' },
];

export const RANGE_CAPTION: Record<Range, string> = {
  '30': 'trials from the last 30 days',
  '90': 'trials from the last 90 days',
  all: 'every trial so far',
};

/** Callbacks every view uses to drill into a group of people. */
export interface Drill {
  /** Opens the plain people list, for groups where the status badge matters */
  people: (title: string, userIds: string[]) => void;
  /** Opens the case list with verdicts, for lost athletes */
  cases: (title: string, userIds: string[], hint?: string) => void;
  /** Switches to the Agent view and sends this question */
  ask: (question: string) => void;
}

export interface ConversionTabProps {
  users: UserRecord[];
  push: (s: Screen) => void;
}

/** Loads the cases when the tab first opens, so the home page never waits on Stripe. */
function useConversionData(): { data: ConversionData | null; error: string | null; retry: () => void } {
  const [data, setData] = useState<ConversionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(null);
    fetch('/api/conversion-data')
      .then(async res => {
        const json = (await res.json()) as ConversionData | { error: string };
        if (!res.ok || 'error' in json) throw new Error('error' in json ? json.error : `Request failed (${res.status})`);
        if (!cancelled) setData(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  return { data, error, retry: () => setNonce(n => n + 1) };
}

function LoadingState({ error, retry }: { error: string | null; retry: () => void }) {
  if (error) {
    return (
      <Card padding="wide" style={{ background: 'var(--amber-100)', borderColor: 'var(--amber-200)' }}>
        <p style={{ margin: 0, font: '500 13px/1.5 var(--font-sans)', color: 'var(--amber-800)' }}>Could not load the conversion data: {error}</p>
        <button type="button" onClick={retry} style={{ marginTop: 8, border: '1px solid var(--amber-200)', borderRadius: 'var(--radius-full)', padding: '5px 10px', background: 'var(--surface-card)', color: 'var(--amber-800)', font: '600 11px/1.2 var(--font-sans)', cursor: 'pointer' }}>Try again</button>
      </Card>
    );
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Skeleton width="55%" height={34} radius={8} />
      <Skeleton width="80%" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8 }}>
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
        <Skeleton height={72} radius={16} />
      </div>
      <Skeleton height={180} radius={16} />
      <p style={{ margin: 0, font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>Reading every trial from Supabase and Stripe…</p>
    </div>
  );
}

export function ConversionTab({ users, push }: ConversionTabProps) {
  const { data, error, retry } = useConversionData();
  if (!data) return <LoadingState error={error} retry={retry} />;
  return <LoadedConversionTab data={data} users={users} push={push} />;
}

function LoadedConversionTab({ data, users, push }: ConversionTabProps & { data: ConversionData }) {
  const [view, setView] = useState<View>('why');
  const [range, setRange] = useState<Range>('all');
  const [seed, setSeed] = useState<AgentSeed | null>(null);

  const report = useMemo(() => buildConversionReport(data, range === 'all' ? null : rangeForDays(Number(range))), [data, range]);
  const caseById = useMemo(() => new Map<string, ChurnCase>(data.cases.map(c => [c.lifecycle.userId, c])), [data.cases]);
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const drill: Drill = {
    people: (title, userIds) => {
      const group = userIds.map(id => userById.get(id)).filter((u): u is UserRecord => u !== undefined);
      push({ key: `conv-people-${title}-${userIds.length}`, node: <PeopleScreen title={title} users={group} /> });
    },
    cases: (title, userIds, hint) => {
      const group = userIds.map(id => caseById.get(id)).filter((c): c is ChurnCase => c !== undefined);
      push({ key: `conv-cases-${title}-${userIds.length}`, node: <CaseListScreen title={title} hint={hint} cases={group} /> });
    },
    ask: question => {
      setSeed({ text: question, nonce: Date.now() });
      setView('agent');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  };

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <SegmentedControl value={view} onChange={k => setView(k as View)} options={VIEWS} />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {RANGES.map(r => {
          const on = r.key === range;
          return (
            <button key={r.key} type="button" aria-pressed={on} onClick={() => setRange(r.key)} style={{ border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-full)', padding: '5px 10px', background: on ? 'var(--surface-card)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', font: '600 11px/1.2 var(--font-sans)', cursor: 'pointer' }}>
              {r.label}
            </button>
          );
        })}
      </div>
      <Fade id={view === 'agent' ? 'agent' : view + range}>
        {view === 'why' && <WhyView report={report} caption={RANGE_CAPTION[range]} drill={drill} />}
        {view === 'patterns' && <PatternsView report={report} drill={drill} />}
        {view === 'fix' && <FixView report={report} range={range} drill={drill} />}
        {view === 'agent' && <AgentChat range={range} seed={seed} />}
      </Fade>
    </div>
  );
}
