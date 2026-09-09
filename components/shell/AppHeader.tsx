'use client';
import { Tabs } from '@/components/ui/Tabs';
import { HeaderStat } from '@/components/ui/HeaderStat';
import { CountUp } from '@/components/motion';
import type { UserRecord } from '@/lib/types';

export interface HeaderStatItem {
  key: string;
  label: string;
  value: string | number;
  accent?: boolean;
  title: string;
  users: UserRecord[];
}

export interface AppHeaderProps {
  stats: HeaderStatItem[];
  onStat: (stat: HeaderStatItem) => void;
  tab: string;
  onTab: (key: string) => void;
  /** Events today, shown as a pill on the Activity tab. */
  badge?: number;
}

export function AppHeader({ stats, onStat, tab, onTab, badge }: AppHeaderProps) {
  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'activity', label: 'Activity', badge },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'users', label: 'Users' },
    { key: 'calendar', label: 'Calendar' },
  ];
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 20, margin: '0 -16px', padding: 'calc(var(--safe-top) + 12px) 16px 0', background: 'rgb(247 248 250 / .92)', backdropFilter: 'saturate(1.4) blur(12px)', WebkitBackdropFilter: 'saturate(1.4) blur(12px)', borderBottom: '1px solid var(--border-default)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}><img src="/inkbound-mark-flat.png" alt="" style={{ width: 28, height: 28 }} /><h1 style={{ margin: 0, font: '700 18px/1.4 var(--font-sans)', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>Inkbound</h1></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {stats.map(s => <HeaderStat key={s.key} label={s.label} value={<CountUp value={s.value} />} accent={s.accent} active onClick={() => onStat(s)} />)}
        </div>
      </div>
      <Tabs style={{ marginTop: 10, paddingBottom: 8 }} value={tab} onChange={onTab} tabs={TABS} />
    </header>
  );
}
