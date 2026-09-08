'use client';

import { usePager } from '@/components/motion';
import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { UserRow, type UserRowProps } from '@/components/ui/UserRow';
import { formatDay } from '@/lib/dates';
import type { UserRecord } from '@/lib/types';

export interface PeopleScreenProps {
  title: string;
  users: UserRecord[];
}

function toRowUser(u: UserRecord): UserRowProps['user'] {
  return {
    name: u.name,
    email: u.email,
    phone: u.phone,
    team: u.team,
    status: u.status,
    interval: u.interval,
    joined: formatDay(u.signupDate),
    isParent: u.isParent,
    excludedFromMetrics: u.excludedFromMetrics,
  };
}

export function PeopleScreen({ title, users }: PeopleScreenProps) {
  const { pop, open } = useNav();
  const sorted = [...users].sort((a, b) => b.signupDate.localeCompare(a.signupDate));
  const pager = usePager(sorted, 7);
  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
      <SubHeader title={title} onBack={pop} />
      <div style={{ paddingTop: 16 }}><Card padding="none">
        <p style={{ margin: 0, padding: '10px 16px', borderBottom: '1px solid var(--border-default)', font: '600 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{title.split(' · ')[0]} · {users.length}</p>
        {pager.slice.map((u, i) => (
          <div key={u.id} style={{ borderTop: i ? '1px solid var(--border-subtle)' : 0 }}>
            <UserRow user={toRowUser(u)} showActions={false} onOpen={() => open(u)} />
          </div>
        ))}
        {!users.length && <p style={{ margin: 0, padding: '32px 16px', textAlign: 'center', font: '400 14px var(--font-sans)', color: 'var(--text-secondary)' }}>No one in this group.</p>}
        {pager.footer}
      </Card></div>
    </main>
  );
}
