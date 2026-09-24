'use client';

import { useMemo, useState } from 'react';
import { Fade, usePager } from '@/components/motion';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { formatAgo, formatShortDay, type ProfileCampaign, type ProfileCampaignSchool } from '@/lib/profile';
import type { UserRecord } from '@/lib/types';

export interface CampaignScreenProps { user: UserRecord; campaign: ProfileCampaign }

type Filter = 'all' | 'opened' | 'replied' | 'watched';

const FILTERS: [Filter, string][] = [['all', 'All'], ['opened', 'Opened'], ['replied', 'Replied'], ['watched', 'Watched']];

function matches(s: ProfileCampaignSchool, f: Filter): boolean {
  if (f === 'opened') return s.opened;
  if (f === 'replied') return s.replied;
  if (f === 'watched') return s.watchPct != null;
  return true;
}

function Pill({ label, on }: { label: string; on: boolean }) {
  return <span style={{ borderRadius: 9999, padding: '2px 8px', font: '600 11px/1.5 var(--font-sans)', background: on ? 'var(--green-100)' : 'var(--gray-100)', color: on ? 'var(--green-800)' : 'var(--gray-600)' }}>{label}</span>;
}

function SchoolRow({ school, first }: { school: ProfileCampaignSchool; first: boolean }) {
  const meta = [school.sentAt ? formatShortDay(school.sentAt) : null, school.emails > 1 ? school.emails + ' emails' : null, school.openCount > 0 ? school.openCount + (school.openCount === 1 ? ' open' : ' opens') : null].filter(Boolean).join(' · ');
  return (
    <div style={{ padding: '12px 16px', borderTop: first ? 0 : '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, font: '600 14px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{school.school} <span style={{ font: '400 12px var(--font-sans)', color: 'var(--text-tertiary)' }}>· {school.coach}</span></p>
        <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{meta || 'Not sent yet'}</p>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <Pill label="Opened" on={school.opened} />
        <Pill label="Replied" on={school.replied} />
        <Pill label={school.watchPct != null ? 'Watched ' + Math.round(school.watchPct) + '%' : 'Watched'} on={school.watchPct != null} />
      </div>
    </div>
  );
}

/** Every school one campaign reached, with open, reply and video watch state per school. */
export function CampaignScreen({ user, campaign }: CampaignScreenProps) {
  const { pop } = useNav();
  const [filter, setFilter] = useState<Filter>('all');
  const schools = useMemo(() => campaign.schools.filter(s => matches(s, filter)), [campaign, filter]);
  const pager = usePager(schools, 8);
  const { counts } = campaign;
  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
      <SubHeader title={campaign.name} onBack={pop} />
      <div style={{ paddingTop: 16 }}>
        <p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>{campaign.status}</p>
        <p style={{ margin: '2px 0 0', font: '600 14px/1.4 var(--font-sans)' }}>{user.name.split(' ')[0]} · {formatShortDay(campaign.at)} · {formatAgo(campaign.at)}</p>
        <p style={{ margin: '2px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{counts.schools} schools · {counts.opened} opened · {counts.replied} replied · {counts.watched} watched video</p>
        <div style={{ marginTop: 14, marginBottom: 10 }}><MiniToggle value={filter} onChange={setFilter} options={FILTERS} /></div>
        <Fade id={filter}>
          {schools.length === 0 ? (
            <p style={{ margin: 0, font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>{campaign.schools.length === 0 ? 'No emails sent in this campaign yet.' : 'No schools match this filter.'}</p>
          ) : (
            <Card padding="none" style={{ animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>
              {pager.slice.map((s, i) => <SchoolRow key={s.key} school={s} first={i === 0} />)}
              {pager.footer}
            </Card>
          )}
        </Fade>
      </div>
    </main>
  );
}
