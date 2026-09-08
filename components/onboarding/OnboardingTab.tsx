'use client';

import { useState } from 'react';
import { Fade, type Screen } from '@/components/motion';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { Funnel, FunnelChapterKey, Paywall } from '@/lib/funnel';
import type { UserRecord } from '@/lib/types';
import { SummaryView } from './SummaryView';

type View = 'summary' | 'funnel' | 'steps' | 'paywall';

const VIEWS: { key: View; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'funnel', label: 'Graph' },
  { key: 'steps', label: 'Steps' },
  { key: 'paywall', label: 'Paywall' },
];

export interface OnboardingTabProps {
  funnel: Funnel;
  paywall: Paywall;
  /** Real athletes only (internal and parent accounts already removed). */
  users: UserRecord[];
  push: (s: Screen) => void;
}

export function OnboardingTab({ funnel }: OnboardingTabProps) {
  const [view, setView] = useState<View>('summary');
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [zoomChapter, setZoomChapter] = useState<FunnelChapterKey | null>(null);

  const goStep = (id: string) => {
    const step = funnel.steps.find(s => s.id === id);
    if (!step) return;
    setZoomChapter(step.chapter);
    setSelectedStep(id);
    setView('funnel');
  };

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <SegmentedControl value={view} onChange={k => setView(k as View)} options={VIEWS} />
      <Fade id={view}>
        {view === 'summary' && <SummaryView funnel={funnel} onStep={goStep} />}
      </Fade>
    </div>
  );
}
