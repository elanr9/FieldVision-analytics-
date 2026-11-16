'use client';

import { useState } from 'react';
import { Fade, type Screen } from '@/components/motion';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import type { Funnel, FunnelChapterKey, Paywall } from '@/lib/funnel';
import type { UserRecord } from '@/lib/types';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { GraphView } from './GraphView';
import { PaywallView } from './PaywallView';
import { StepsView } from './StepsView';
import { SummaryView } from './SummaryView';

type View = 'summary' | 'funnel' | 'steps' | 'paywall';

const VIEWS: { key: View; label: string }[] = [
  { key: 'summary', label: 'Summary' },
  { key: 'funnel', label: 'Graph' },
  { key: 'steps', label: 'Steps' },
  { key: 'paywall', label: 'Paywall' },
];

export interface OnboardingTabProps {
  /** One funnel per onboarding flow people used in range, the busiest first. */
  funnels: Funnel[];
  paywall: Paywall;
  /** Real athletes only (internal and parent accounts already removed). */
  users: UserRecord[];
  push: (s: Screen) => void;
}

export function OnboardingTab({ funnels, paywall, users, push }: OnboardingTabProps) {
  const [view, setView] = useState<View>('summary');
  const [flowKey, setFlowKey] = useState(funnels[0].flow);
  const funnel = funnels.find(f => f.flow === flowKey) ?? funnels[0];
  const pickFlow = (key: string) => {
    setFlowKey(key as Funnel['flow']);
    setSelectedStep(null);
    setZoomChapter(null);
  };
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
      {funnels.length > 1 && view !== 'paywall' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>Two onboarding flows had signups in the last 30 days</span>
          <MiniToggle value={funnel.flow} onChange={pickFlow} options={funnels.map(f => [f.flow, f.flowLabel + ' · ' + f.started] as [Funnel['flow'], string])} />
        </div>
      )}
      <Fade id={view}>
        {view === 'summary' && <SummaryView funnel={funnel} onStep={goStep} />}
        {view === 'funnel' && <GraphView funnel={funnel} selectedStep={selectedStep} zoomChapter={zoomChapter} onSelectStep={setSelectedStep} onZoom={setZoomChapter} />}
        {view === 'steps' && <StepsView funnel={funnel} users={users} push={push} onStep={goStep} />}
        {view === 'paywall' && <PaywallView paywall={paywall} />}
      </Fade>
    </div>
  );
}
