'use client';

import { useEffect, useState } from 'react';
import { CountUp, Fade } from '@/components/motion';
import { FIcon } from '@/components/overview/FIcon';
import { Hero } from '@/components/overview/Hero';
import { Mini } from '@/components/overview/Mini';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { SAMPLE_USAGE } from '@/components/overview/sampleUsage';
import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { addDays } from '@/lib/dates';
import { formatShortDay } from '@/lib/profile';
import { FEATURES, type Feature } from '@/lib/usage';
import { Delta } from './Delta';
import { InkLineChart } from './InkLineChart';
import { Spark } from './Spark';

export interface UsageScreenProps {
  /** Feature id to open on Trend; omitted starts on Ranked */
  focus?: string;
}

type View = 'ranked' | 'trend' | 'share';
type Metric = 'users' | 'events' | 'perUser';

const METRIC_KEY: Record<Metric, 'users30' | 'events30' | 'perUser'> = { users: 'users30', events: 'events30', perUser: 'perUser' };
const METRIC_UNIT: Record<Metric, string> = { users: 'users', events: 'events', perUser: 'per user' };
const RAMP = ['var(--ink-900)', 'var(--ink-700)', 'var(--ink-500)', 'var(--ink-400)', 'var(--ink-300)', 'var(--ink-200)', 'var(--gray-300)', 'var(--gray-200)'];
const ICON: Record<string, string> = Object.fromEntries(SAMPLE_USAGE.map(s => [s.id, s.icon]));

/** Loads 30-day feature usage from /api/usage. */
function useUsage(): { usage: Feature[] | null; loading: boolean } {
  const [usage, setUsage] = useState<Feature[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/usage')
      .then(res => (res.ok ? res.json() : null))
      .then((data: Feature[] | null) => { if (!cancelled) setUsage(data); })
      .catch(() => { if (!cancelled) setUsage(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { usage, loading };
}

const byEvents = (usage: Feature[]) => [...usage].sort((a, b) => b.events30 - a.events30);

export function UsageScreen({ focus }: UsageScreenProps) {
  const { pop } = useNav();
  const { usage, loading } = useUsage();
  const focused = FEATURES.some(f => f.id === focus) ? focus : undefined;
  const [metric, setMetric] = useState<Metric>('users');
  const [sel, setSel] = useState<string | null>(focused ?? FEATURES[0].id);
  const [view, setView] = useState<View>(focused ? 'trend' : 'ranked');

  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
      <SubHeader title="Feature usage" onBack={pop} />
      <div style={{ paddingTop: 16, display: 'grid', gap: 12, gridTemplateColumns: 'minmax(0,1fr)' }}>
        <SegmentedControl value={view} onChange={k => setView(k as View)} options={[{ key: 'ranked', label: 'Ranked' }, { key: 'trend', label: 'Trend' }, { key: 'share', label: 'Share' }]} />
        {loading && <Skeleton height={240} radius={16} />}
        {!loading && !usage && <p style={{ margin: 0, font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>Usage could not be loaded.</p>}
        {usage && <Fade id={view}>
          {view === 'ranked' && <Ranked usage={usage} metric={metric} setMetric={setMetric} sel={sel} setSel={setSel} />}
          {view === 'trend' && <Trend usage={usage} sel={sel} setSel={setSel} />}
          {view === 'share' && <Share usage={usage} />}
        </Fade>}
      </div>
    </main>
  );
}

interface RankedProps { usage: Feature[]; metric: Metric; setMetric: (m: Metric) => void; sel: string | null; setSel: (id: string | null) => void }

function Ranked({ usage, metric, setMetric, sel, setSel }: RankedProps) {
  const key = METRIC_KEY[metric];
  const sorted = [...usage].sort((a, b) => b[key] - a[key]);
  const max = Math.max(1, sorted[0][key]);
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><SectionHeading style={{ marginBottom: 0 }}>Last 30 days</SectionHeading><MiniToggle<Metric> value={metric} onChange={setMetric} options={[['users', 'Users'], ['events', 'Events'], ['perUser', 'Per user']]} /></div>
      <Card padding="none">
        {sorted.map((f, i) => { const on = sel === f.id; return (
          <button key={f.id} type="button" onClick={() => setSel(on ? null : f.id)} style={{ display: 'grid', gridTemplateColumns: '18px 1fr 80px auto', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', background: on ? 'var(--ink-50)' : 'transparent', border: 0, borderTop: i ? '1px solid var(--border-subtle)' : 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', transition: 'background-color var(--duration-fast)' }}>
            <FIcon path={ICON[f.id]} size={18} color={on ? 'var(--ink-900)' : 'var(--ink-600)'} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ font: '600 14px/1.3 var(--font-sans)' }}>{f.label}</span>{!f.missing && <Delta v={f.delta} />}</span>
              <span style={{ display: 'block', marginTop: 6, height: 6, borderRadius: 3, background: 'var(--surface-track)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: (f[key] / max * 100) + '%', background: 'var(--ink-700)', borderRadius: 3, transformOrigin: '0 0', animation: 'ink-grow-x 600ms var(--ease-out) both' }} /></span>
            </span>
            {f.missing ? <span /> : <Spark days={f.days} w={80} />}
            <span style={{ textAlign: 'right', minWidth: 56 }}><span style={{ display: 'block', font: '700 16px/1.2 var(--font-sans)', fontVariantNumeric: 'tabular-nums' }}>{f.missing ? '—' : <CountUp value={f[key]} decimals={metric === 'perUser' ? 1 : 0} />}</span><span style={{ font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{METRIC_UNIT[metric]}</span></span>
          </button>); })}
      </Card>
    </section>
  );
}

interface TrendProps { usage: Feature[]; sel: string | null; setSel: (id: string) => void }

function Trend({ usage, sel, setSel }: TrendProps) {
  const selF = usage.find(f => f.id === sel) ?? byEvents(usage)[0];
  const today = new Date();
  const dayLabels = selF.days.map((_, i) => formatShortDay(addDays(today, -(selF.days.length - 1 - i)).toISOString(), today));
  const missing = selF.missing;
  return (
    <section key={selF.id}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 8px' }}>{byEvents(usage).map(f => <button key={f.id} type="button" onClick={() => setSel(f.id)} style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, border: 0, borderRadius: 9999, padding: '6px 12px', cursor: 'pointer', font: '600 12px/1.4 var(--font-sans)', background: selF.id === f.id ? 'var(--ink-700)' : 'var(--gray-100)', color: selF.id === f.id ? '#fff' : 'var(--gray-600)' }}><FIcon path={ICON[f.id]} size={14} color="currentColor" />{f.label}</button>)}</div>
      <Hero label={selF.label + ' · 30 days'} value={missing ? '—' : selF.events30} caption={missing ? selF.desc + ' · no event yet' : selF.desc + ' · ' + selF.users30 + ' users · ' + selF.perUser + ' per user'} right={missing ? undefined : <Delta v={selF.delta} />} />
      <Card padding="wide" style={{ marginTop: 12 }}>
        {missing
          ? <p style={{ margin: 0, height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>—</p>
          : <InkLineChart data={selF.days.map((v, i) => ({ label: dayLabels[i], v }))} series={[{ key: 'v', color: 'var(--ink-700)' }]} height={170} />}
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
        <Mini label="Best day" value={missing ? '—' : Math.max(...selF.days)} sub="events" />
        <Mini label="Avg / day" value={missing ? '—' : Math.round(selF.events30 / selF.days.length)} sub="events" />
        <Mini label="Last 15d" value={missing ? '—' : (selF.delta >= 0 ? '+' : '') + selF.delta + '%'} sub="vs prior 15d" />
      </div>
    </section>
  );
}

function Share({ usage }: { usage: Feature[] }) {
  const tracked = usage.filter(f => !f.missing);
  const totalEvents = tracked.reduce((s, f) => s + f.events30, 0);
  const active = tracked.length ? Math.max(...tracked.map(f => f.users30)) : 0;
  const least = [...tracked].sort((a, b) => a.users30 - b.users30)[0];
  const ranked = byEvents(usage);
  const share = (f: Feature) => (totalEvents ? f.events30 / totalEvents * 100 : 0);
  return (
    <section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginBottom: 12 }}>
        <Mini label="Events" value={totalEvents} sub={Math.round(totalEvents / 30) + ' per day'} />
        <Mini label="Active users" value={active} sub="any feature" />
        <Mini label="Least used" value={least ? least.users30 : '—'} sub={least ? least.label : 'no events'} />
      </div>
      <Card padding="wide">
        <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2 }}>{ranked.map((f, i) => <span key={f.id} style={{ width: share(f) + '%', background: RAMP[i] }} />)}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 12 }}>{ranked.map((f, i) => <span key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, font: '400 12px/1.5 var(--font-sans)', color: 'var(--gray-600)' }}><span style={{ width: 8, height: 8, borderRadius: 2, background: RAMP[i] }} />{f.label} <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{f.missing ? '—' : Math.round(share(f)) + '%'}</span></span>)}</div>
      </Card>
    </section>
  );
}
