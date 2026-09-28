'use client';

import { useMemo, useState } from 'react';
import { Fade, type Screen } from '@/components/motion';
import { PeopleScreen } from '@/components/people/PeopleScreen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { buildConversionReport, type ChurnCase, type ConversionData } from '@/lib/conversion/report';
import { rangeForDays } from '@/lib/funnel';
import type { UserRecord } from '@/lib/types';
import { CaseListScreen } from './CaseListScreen';
import { FixView } from './FixView';
import { PatternsView } from './PatternsView';
import { WhyView } from './WhyView';

type View = 'why' | 'patterns' | 'fix';
type Range = '30' | '90' | 'all';

const VIEWS: { key: View; label: string }[] = [
  { key: 'why', label: 'Why they leave' },
  { key: 'patterns', label: 'Patterns' },
  { key: 'fix', label: 'Fix plan' },
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
}

export interface ConversionTabProps {
  data: ConversionData;
  users: UserRecord[];
  push: (s: Screen) => void;
}

export function ConversionTab({ data, users, push }: ConversionTabProps) {
  const [view, setView] = useState<View>('why');
  const [range, setRange] = useState<Range>('all');

  const report = useMemo(() => buildConversionReport(data, range === 'all' ? null : rangeForDays(Number(range))), [data, range]);
  const caseById = useMemo(() => new Map<string, ChurnCase>(data.cases.map(c => [c.lifecycle.userId, c])), [data.cases]);
  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const drill: Drill = {
    people: (title, userIds) => {
      const group = userIds.map(id => userById.get(id)).filter((u): u is UserRecord => u !== undefined);
      push({ key: 'conv-people-' + title, node: <PeopleScreen title={title} users={group} /> });
    },
    cases: (title, userIds, hint) => {
      const group = userIds.map(id => caseById.get(id)).filter((c): c is ChurnCase => c !== undefined);
      push({ key: 'conv-cases-' + title, node: <CaseListScreen title={title} hint={hint} cases={group} /> });
    },
  };

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <SegmentedControl value={view} onChange={k => setView(k as View)} options={VIEWS} />
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {RANGES.map(r => {
          const on = r.key === range;
          return (
            <button key={r.key} type="button" onClick={() => setRange(r.key)} style={{ border: `1px solid ${on ? 'var(--border-strong)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-full)', padding: '5px 10px', background: on ? 'var(--surface-card)' : 'transparent', color: on ? 'var(--text-primary)' : 'var(--text-secondary)', font: '600 11px/1.2 var(--font-sans)', cursor: 'pointer' }}>
              {r.label}
            </button>
          );
        })}
      </div>
      <Fade id={view + range}>
        {view === 'why' && <WhyView report={report} caption={RANGE_CAPTION[range]} drill={drill} />}
        {view === 'patterns' && <PatternsView report={report} drill={drill} />}
        {view === 'fix' && <FixView report={report} range={range} drill={drill} />}
      </Fade>
    </div>
  );
}
