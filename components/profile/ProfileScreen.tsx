'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import { CountUp, Fade, usePager } from '@/components/motion';
import { Mini } from '@/components/overview/Mini';
import { MiniToggle } from '@/components/overview/MiniToggle';
import { ConversationScreen } from '@/components/profile/ConversationScreen';
import { CheckinSheet } from '@/components/activity/CheckinSheet';
import { useDossier } from '@/components/profile/useDossier';
import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { ContactActions } from '@/components/ui/ContactActions';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatBlock } from '@/components/ui/StatBlock';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tag } from '@/components/ui/Tag';
import { lastSentAt } from '@/lib/checkins';
import { buildFacts, buildProfile, formatAgo, formatShortDay, planLabel, type BackgroundChapterKey, type ProfileReply, type ProfileVideo } from '@/lib/profile';
import type { UserRecord } from '@/lib/types';

export interface ProfileScreenProps { user: UserRecord }

type Section = 'background' | 'videos' | 'replies';

const CHAPTERS: [BackgroundChapterKey, string][] = [['basic', 'Background'], ['checkin', 'Where'], ['academic', 'Academics'], ['athletic', 'Game'], ['goals', 'Goals']];

const EMPTY_TEXT: CSSProperties = { margin: 0, font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' };

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ margin: 0, font: '600 10px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-secondary)' }}>{label}</p>
      <p style={{ margin: '2px 0 0', font: '600 14px/1.4 var(--font-sans)' }}>{value}</p>
    </div>
  );
}

function VideoRow({ video, first }: { video: ProfileVideo; first: boolean }) {
  return (
    <div style={{ padding: '12px 16px', borderTop: first ? 0 : '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, font: '600 14px/1.4 var(--font-sans)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title}</p>
        <p style={{ margin: 0, font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{formatShortDay(video.createdAt)} · {formatAgo(video.createdAt)} · {video.uniqueCoaches} coaches · {video.coachViews} views</p>
      </div>
      <span style={{ flexShrink: 0, borderRadius: 9999, padding: '2px 8px', font: '600 11px/1.5 var(--font-sans)', background: video.published ? 'var(--green-100)' : 'var(--gray-100)', color: video.published ? 'var(--green-800)' : 'var(--gray-600)' }}>{video.status}</span>
    </div>
  );
}

function ReplyRow({ reply, first, onOpen }: { reply: ProfileReply; first: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', padding: '12px 16px', borderTop: first ? 0 : '1px solid var(--border-subtle)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ margin: 0, font: '600 14px/1.4 var(--font-sans)' }}>{reply.school} <span style={{ font: '400 12px var(--font-sans)', color: 'var(--text-tertiary)' }}>· {reply.coach}</span></p>
        <span style={{ font: '400 11px/1.4 var(--font-sans)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{formatAgo(reply.repliedAt)} ›</span>
      </div>
      <p style={{ margin: '4px 0 0', font: '400 13px/1.5 var(--font-sans)', color: 'var(--gray-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{reply.snippet}</p>
    </button>
  );
}

/** The athlete who invited this parent: parent_invites.player_user_id maps to the athlete's parentEmail. */
function findAthlete(parent: UserRecord, users: UserRecord[]): UserRecord | null {
  const email = parent.email.toLowerCase();
  if (!email) return null;
  return users.find(u => !u.isParent && u.parentEmail?.toLowerCase() === email) ?? null;
}

export function ProfileScreen({ user }: ProfileScreenProps) {
  const { push, pop, open, users, checkinLog, onCheckinSent } = useNav();
  const athlete = user.isParent ? findAthlete(user, users) : null;
  const { dossier, loading } = useDossier(user.isParent ? athlete?.id ?? null : user.id);
  const lastCheckinAt = lastSentAt(user.id, checkinLog);
  const profile = useMemo(() => buildProfile(user, dossier, new Date(), lastCheckinAt), [user, dossier, lastCheckinAt]);
  const [texting, setTexting] = useState(false);
  const [sec, setSec] = useState<Section>('background');
  const [chap, setChap] = useState<BackgroundChapterKey>('basic');
  const videos = usePager(profile.videos, 3);
  const replies = usePager(profile.replies, 3);
  const chapter = profile.background.find(c => c.key === chap) ?? profile.background[0];

  if (user.isParent) {
    const active = Boolean(user.lastSignInAt);
    return (
      <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
        <SubHeader title={user.name} onBack={pop} />
        <div style={{ paddingTop: 20 }}>
          <h2 style={{ margin: 0, font: '700 26px/1.2 var(--font-sans)', letterSpacing: '-0.015em' }}>{user.name}</h2>
          <p style={{ margin: '4px 0 0', font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{[user.email || 'No email', user.phone].filter(Boolean).join(' · ')}</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
            <Tag kind="soft">Parent</Tag>
            <span style={{ borderRadius: 9999, padding: '2px 8px', font: '600 11px/1.5 var(--font-sans)', background: active ? 'var(--green-100)' : 'var(--gray-100)', color: active ? 'var(--green-800)' : 'var(--text-secondary)' }}>{active ? 'Opened the app' : 'Never opened the app'}</span>
          </div>
          <Card padding="wide" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Fact label="Joined" value={formatShortDay(user.signupDate)} />
            <Fact label="Invited by" value={athlete ? athlete.name.split(' ')[0] + ' · onboarding' : '—'} />
          </Card>
          <div style={{ marginTop: 12 }}><ContactActions phone={user.phone} email={user.email} size="lg" /></div>
          <SectionHeading style={{ marginTop: 28 }}>Their athlete</SectionHeading>
          {athlete ? (
            <Card interactive padding="wide" onClick={() => open(athlete)} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, font: '700 16px/1.3 var(--font-sans)' }}>{athlete.name}</p>
                <p style={{ margin: '2px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{buildFacts(athlete) || 'No team on file'}</p>
                <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <StatusBadge status={athlete.status} />
                  {(athlete.status === 'paying' || athlete.status === 'trialing') && <span style={{ font: '400 12px var(--font-sans)', color: 'var(--text-secondary)' }}>{planLabel(athlete.paymentType, athlete.interval)}</span>}
                </div>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontSize: 22, lineHeight: 1 }}>›</span>
            </Card>
          ) : <p style={EMPTY_TEXT}>No athlete linked.</p>}
          {athlete && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 8 }}>
              <Mini label="Emails" value={profile.stats.emails} sub="to coaches" />
              <Mini label="Replies" value={profile.stats.replies} sub="from coaches" />
              <Mini label="Videos" value={profile.videos.length} sub="made" />
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
      <SubHeader title={user.name} onBack={pop} />
      <div style={{ paddingTop: 20 }}>
        <h2 style={{ margin: 0, font: '700 26px/1.2 var(--font-sans)', letterSpacing: '-0.015em' }}>{user.name}</h2>
        <p style={{ margin: '4px 0 0', font: '400 14px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{[user.email || 'No email', user.phone].filter(Boolean).join(' · ')}</p>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          <StatusBadge status={user.status} />
          {user.excludedFromMetrics && <Tag kind="soft">Internal</Tag>}
          {user.fakeReason && <Tag kind="soft">Likely fake · {user.fakeReason}</Tag>}
        </div>
        <Card padding="wide" style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 12, paddingBottom: 12 }}>
          <Fact label="Plan" value={profile.planFact[0]} />
          <Fact label={user.status === 'paying' ? 'Billing' : 'Status'} value={profile.planFact[1]} />
          {profile.facts && <Fact label="Team · position · grad" value={profile.facts} />}
          {profile.checkinEligible && <Fact label="Last check-in" value={profile.lastCheckin} />}
        </Card>
        <div style={{ marginTop: 12 }}><ContactActions phone={user.phone} email={user.email} size="lg" onText={profile.checkinEligible ? () => setTexting(true) : undefined} /></div>
        <CheckinSheet user={texting ? user : null} checkinLog={checkinLog} onClose={() => setTexting(false)} onSent={onCheckinSent} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 10 }}>
          <StatBlock label="Emails" value={<CountUp value={profile.stats.emails} />} />
          <StatBlock label="Replies" value={<CountUp value={profile.stats.replies} />} />
          <StatBlock label="HL views" value={<CountUp value={profile.stats.views} />} />
          <StatBlock label="Calls" value={<CountUp value={profile.stats.calls} />} />
        </div>
        <SegmentedControl style={{ marginTop: 12, marginBottom: 10 }} value={sec} onChange={k => setSec(k as Section)} options={[{ key: 'background', label: 'Background' }, { key: 'videos', label: 'Videos · ' + profile.videos.length }, { key: 'replies', label: 'Replies · ' + profile.replies.length }]} />
        <Fade id={sec + chap}>
          {sec === 'background' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <MiniToggle value={chap} onChange={setChap} options={CHAPTERS} />
              <Card padding="wide" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', paddingTop: 12, paddingBottom: 12 }}>
                {chapter.rows.map(([k, v]) => (
                  <div key={k} style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, font: '500 10px/1.3 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.03em', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</p>
                    <p style={{ margin: '1px 0 0', font: '500 13px/1.35 var(--font-sans)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</p>
                  </div>
                ))}
              </Card>
            </div>
          )}
          {sec === 'videos' && (loading ? <Skeleton height={56} radius={12} /> : profile.videos.length === 0 ? <p style={EMPTY_TEXT}>No highlight videos yet.</p> : (
            <Card padding="none" style={{ animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>
              {videos.slice.map((v, i) => <VideoRow key={v.id} video={v} first={i === 0} />)}
              {videos.footer}
            </Card>
          ))}
          {sec === 'replies' && (loading ? <Skeleton height={72} radius={12} /> : profile.replies.length === 0 ? <p style={EMPTY_TEXT}>No coach replies yet.</p> : (
            <Card padding="none" style={{ animation: 'ink-fade var(--duration-base) var(--ease-out) both' }}>
              {replies.slice.map((r, i) => <ReplyRow key={r.id} reply={r} first={i === 0} onOpen={() => push({ key: 'convo-' + r.id, node: <ConversationScreen user={user} reply={r} /> })} />)}
              {replies.footer}
            </Card>
          ))}
        </Fade>
      </div>
    </main>
  );
}
