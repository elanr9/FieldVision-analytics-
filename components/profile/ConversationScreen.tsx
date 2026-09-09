'use client';

import { usePager } from '@/components/motion';
import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { buildThread, formatAgo, formatShortDay, type ProfileReply } from '@/lib/profile';
import type { UserRecord } from '@/lib/types';

export interface ConversationScreenProps { user: UserRecord; reply: ProfileReply }

/** One coach conversation, read-only, as it looks in the athlete's Inkbound inbox. */
export function ConversationScreen({ user, reply }: ConversationScreenProps) {
  const { pop } = useNav();
  const msgs = buildThread(reply);
  const pager = usePager(msgs, 4);
  const firstName = user.name.split(' ')[0];
  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px calc(var(--safe-bottom) + 16px)', fontFamily: 'var(--font-sans)', height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <SubHeader title={reply.school} onBack={pop} />
      <div style={{ paddingTop: 16, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>Subject</p>
        <p style={{ margin: '2px 0 0', font: '600 14px/1.4 var(--font-sans)' }}>{reply.subject ?? '(no subject)'}</p>
        <p style={{ margin: '2px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{user.name} ↔ {reply.coach} · {reply.school}</p>
        <div style={{ display: 'grid', gap: 10, marginTop: 16, flex: 1, minHeight: 0, overflowY: 'auto', alignContent: 'start', paddingBottom: 16 }}>
          {pager.slice.map((m, i) => {
            const me = m.from === 'athlete';
            const meta = [me ? firstName : reply.coach, m.at ? formatShortDay(m.at) : null, m.at ? formatAgo(m.at) : null].filter(Boolean).join(' · ');
            return (
              <div key={pager.page * 4 + i} style={{ display: 'flex', flexDirection: 'column', alignItems: me ? 'flex-end' : 'flex-start', animation: `ink-fade var(--duration-base) var(--ease-out) ${i * 60}ms both` }}>
                <div style={{ maxWidth: '86%', background: me ? 'var(--ink-700)' : 'var(--surface-card)', color: me ? '#fff' : 'var(--text-primary)', border: me ? 0 : '1px solid var(--border-default)', borderRadius: me ? '16px 16px 4px 16px' : '16px 16px 16px 4px', padding: '10px 14px', font: '400 14px/1.5 var(--font-sans)', whiteSpace: 'pre-line', overflowWrap: 'anywhere' }}>{m.text}</div>
                <span style={{ marginTop: 3, font: '400 10px/1.4 var(--font-sans)', color: 'var(--text-tertiary)' }}>{meta}</span>
              </div>
            );
          })}
        </div>
        {pager.footer}
      </div>
    </main>
  );
}
