'use client';

import { useState } from 'react';
import { Fade, usePager } from '@/components/motion';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Input } from '@/components/users/Input';
import { NameRow } from '@/components/users/NameRow';
import { planLabel } from '@/lib/profile';
import { STATUS_LABEL, type UserStatus } from '@/lib/types';
import type { EveryoneRecord } from '@/lib/users';

type Bucket = 'customers' | 'leads' | 'parents' | 'junk';
type SubFilter = [key: string, label: string, match: (u: EveryoneRecord) => boolean];

/** "today" | "yesterday" | "3d ago"; "—" when the date is not on record */
function ago(days: number | null): string {
  if (days == null) return '—';
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return days + 'd ago';
}

/** "Aug 25", the mock's signup date format */
function joined(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const RIGHT: Record<UserStatus, (u: EveryoneRecord) => string> = {
  paying: u => planLabel(u.paymentType, u.interval),
  trialing: u => 'ends in ' + (u.trialEndsIn == null ? '—' : u.trialEndsIn + 'h'),
  churned: u => 'left ' + ago(u.cancelledAgo),
  trial_ended: u => 'ended ' + ago(u.trialEndedAgo),
  signed_up: u => u.onboarding === 'in_progress' ? 'stuck · ' + (u.onboardingStepId || 'onboarding') : u.stoppedAtPaywall ? 'saw paywall' : 'joined ' + joined(u.signupDate),
  comped: () => 'comped',
};

const CUSTOMER_STATUSES: UserStatus[] = ['paying', 'trialing', 'churned'];
const LEAD_STATUSES: UserStatus[] = ['trial_ended', 'signed_up'];

export interface UsersTabProps {
  /** Output of loadEveryone: every non-excluded account */
  users: EveryoneRecord[];
}

export function UsersTab({ users }: UsersTabProps) {
  const { open } = useNav();
  const [seg, setSeg] = useState<Bucket>('customers');
  const [sub, setSub] = useState('paying');
  const [q, setQ] = useState('');

  const all = users.filter(u => !u.excludedFromMetrics);
  const real = all.filter(u => !u.junk && !u.isParent), junk = all.filter(u => u.junk), parents = all.filter(u => u.isParent && !u.junk);
  const byId = new Map(all.map(u => [u.id, u]));
  const athleteOf = (p: EveryoneRecord) => (p.athleteId ? byId.get(p.athleteId) : undefined);

  const buckets: Record<Bucket, { label: string; subs: SubFilter[] }> = {
    customers: { label: 'Customers', subs: [['paying', 'Paying', u => u.status === 'paying'], ['trialing', 'Trialing', u => u.status === 'trialing'], ['churned', 'Churned', u => u.status === 'churned']] },
    leads: { label: 'Leads', subs: [['trial_ended', 'Trial ended', u => u.status === 'trial_ended'], ['paywall', 'Saw paywall', u => u.status === 'signed_up' && u.stoppedAtPaywall], ['stuck', 'Stuck', u => u.status === 'signed_up' && u.onboarding === 'in_progress']] },
    parents: { label: 'Parents', subs: [['all', 'All', () => true], ['paying', 'Athlete paying', p => athleteOf(p)?.status === 'paying'], ['trialing', 'Athlete trialing', p => athleteOf(p)?.status === 'trialing'], ['active', 'Opened app', p => p.parentActive]] },
    junk: { label: 'Likely fake', subs: [['all', 'All', () => true]] },
  };
  const isBucket = (k: string): k is Bucket => k in buckets;
  const changeBucket = (k: string) => {
    if (!isBucket(k)) return;
    setSeg(k);
    setSub(buckets[k].subs[0][0]);
  };

  const b = buckets[seg];
  const pool = seg === 'junk' ? junk : seg === 'parents' ? parents : real;
  const subDef = b.subs.find(x => x[0] === sub) || b.subs[0];
  const ql = q.trim().toLowerCase();
  const rows = (ql ? all.filter(u => (u.name + ' ' + u.email + ' ' + (u.team || '') + ' ' + (u.phone || '')).toLowerCase().includes(ql)) : pool.filter(subDef[2])).sort((a, b) => b.signupDate.localeCompare(a.signupDate));
  const pager = usePager(rows, (seg === 'junk' || seg === 'parents') && !ql ? 6 : 8);
  const count = (fn: SubFilter[2]) => pool.filter(fn).length;
  const segLabel = (k: Bucket) => k === 'customers' ? 'Customers ' + real.filter(u => CUSTOMER_STATUSES.includes(u.status)).length : k === 'leads' ? 'Leads ' + real.filter(u => LEAD_STATUSES.includes(u.status)).length : k === 'parents' ? 'Parents ' + parents.length : 'Fake ' + junk.length;

  const rightFor = (u: EveryoneRecord) => {
    if (u.isParent) { const a = athleteOf(u); return a ? 'athlete ' + STATUS_LABEL[a.status].toLowerCase() : 'no athlete linked'; }
    if (seg === 'junk' && !ql) return joined(u.signupDate);
    return (RIGHT[u.status] || RIGHT.signed_up)(u);
  };
  const subFor = (u: EveryoneRecord) => {
    if (u.isParent) { const a = athleteOf(u); return 'Parent of ' + (a ? a.name : '—') + (u.parentActive ? ' · opened the app' : ' · never opened'); }
    if (seg === 'junk' && !ql) return u.junkReason ?? undefined;
    return ql ? STATUS_LABEL[u.status] : undefined;
  };

  return (
    <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px' }}>
        <p style={{ margin: 0, font: '400 12px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}><b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{all.length}</b> accounts · <b style={{ color: 'var(--metric-money)', fontWeight: 600 }}>{real.filter(u => u.status === 'paying').length}</b> paying · <b style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{real.length}</b> athletes · {parents.length} parents · {junk.length} fake</p>
      </div>
      <Input type="search" placeholder="Search anyone" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '8px 12px', fontSize: 14, lineHeight: '20px' }} />
      {!ql && <>
        <SegmentedControl value={seg} onChange={changeBucket} options={(Object.keys(buckets) as Bucket[]).map(k => ({ key: k, label: segLabel(k) }))} />
        {b.subs.length > 1 && <div style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px' }}><MiniToggle value={sub} onChange={setSub} options={b.subs.map(([k, l, fn]) => [k, l + ' ' + count(fn)])} /></div>}
      </>}
      <Fade id={seg + sub + (ql ? 'q' : '')}>
        <Card padding="none">
          {ql && <p style={{ margin: 0, padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', font: '600 11px/1.4 var(--font-sans)', color: 'var(--text-secondary)' }}>{rows.length} match{rows.length === 1 ? '' : 'es'}</p>}
          {pager.slice.length === 0 && <p style={{ margin: 0, padding: '28px 16px', textAlign: 'center', font: '400 14px var(--font-sans)', color: 'var(--text-secondary)' }}>Nobody here.</p>}
          {pager.slice.map((u, i) => <div key={u.id} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}><NameRow name={u.name} onOpen={() => open(u)} right={rightFor(u)} sub={subFor(u)} /></div>)}
          {pager.footer}
        </Card>
      </Fade>
      {seg === 'junk' && !ql && <p style={{ margin: 0, font: '400 11px/1.5 var(--font-sans)', color: 'var(--text-tertiary)', padding: '0 2px' }}>Flagged by rule: test-looking name or email, no last name with zero activity, duplicate email, or never opened the app. Excluded from every metric.</p>}
    </div>
  );
}
