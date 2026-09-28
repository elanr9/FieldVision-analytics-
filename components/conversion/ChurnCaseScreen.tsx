'use client';

import { SubHeader } from '@/components/shell/SubHeader';
import { useNav } from '@/components/shell/nav';
import { Card } from '@/components/ui/Card';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { StatBlock } from '@/components/ui/StatBlock';
import { OUTCOME_LABEL } from '@/lib/conversion/lifecycle';
import { REASON_META } from '@/lib/conversion/reasons';
import { FIX_PLAYBOOK, type ChurnCase } from '@/lib/conversion/report';
import { CaseAi } from './CaseAi';
import { days, money, shortDate } from './format';

export interface ChurnCaseScreenProps {
  item: ChurnCase;
}

interface Moment {
  at: string;
  label: string;
  tone?: 'good' | 'bad';
}

function buildTimeline(item: ChurnCase): Moment[] {
  const l = item.lifecycle;
  const e = l.engagement;
  const moments: Moment[] = [{ at: l.signupAt, label: 'Created the account' }];
  if (l.trialStartAt) {
    moments.push({ at: l.trialStartAt, label: 'Finished onboarding' });
    moments.push({ at: l.trialStartAt, label: l.planLabel ? `Started the trial on ${l.planLabel}` : 'Started the trial', tone: 'good' });
  } else if (l.onboarding === 'completed') {
    moments.push({ at: l.signupAt, label: 'Finished onboarding, stopped at the paywall' });
  }
  if (e.firstActiveAt) moments.push({ at: e.firstActiveAt, label: 'First activity' });
  if (e.lastActiveAt && e.lastActiveAt !== e.firstActiveAt) moments.push({ at: e.lastActiveAt, label: 'Last activity in the window' });
  if (l.firstChargeAt) moments.push({ at: l.firstChargeAt, label: l.stripe?.chargedCents ? `Charged ${money(l.stripe.chargedCents)}` : 'Charged', tone: 'good' });
  if (l.canceledAt) moments.push({ at: l.canceledAt, label: l.outcome === 'payment_failed' ? 'Card failed' : 'Canceled', tone: 'bad' });
  else if (l.outcome === 'trial_expired' && l.trialEndAt) moments.push({ at: l.trialEndAt, label: 'Trial expired, no charge', tone: 'bad' });
  return moments.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

const row: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderTop: '1px solid var(--border-subtle)', font: '400 13px/1.5 var(--font-sans)' };

export function ChurnCaseScreen({ item }: ChurnCaseScreenProps) {
  const { pop, open, users } = useNav();
  const l = item.lifecycle;
  const e = l.engagement;
  const user = users.find(u => u.id === l.userId);
  const meta = item.verdict ? REASON_META[item.verdict.reason] : null;
  const play = item.verdict ? FIX_PLAYBOOK[item.verdict.reason] : null;
  const timeline = buildTimeline(item);

  return (
    <main style={{ maxWidth: 768, margin: '0 auto', padding: '0 16px 64px', fontFamily: 'var(--font-sans)' }}>
      <SubHeader title={l.name} onBack={pop} right={user && <button type="button" onClick={() => open(user)} style={{ background: 'none', border: 0, padding: '6px 4px', cursor: 'pointer', font: '500 14px/1.2 var(--font-sans)', color: 'var(--ink-600)' }}>Profile</button>} />
      <div style={{ display: 'grid', gap: 16, paddingTop: 16 }}>
        <Card padding="wide" style={{ borderLeft: `4px solid ${meta?.accent ?? 'var(--green-500)'}` }}>
          <p style={{ margin: 0, font: '600 11px/1.4 var(--font-sans)', textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-secondary)' }}>{OUTCOME_LABEL[l.outcome]}</p>
          <p style={{ margin: '4px 0 0', font: '700 22px/1.2 var(--font-sans)', letterSpacing: '-0.01em' }}>{meta?.title ?? (l.outcome === 'converted' ? 'Paying customer' : 'In the trial right now')}</p>
          {meta && <p style={{ margin: '6px 0 0', font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{meta.meaning}</p>}
          {item.verdict && item.verdict.evidence.length > 0 && (
            <ul style={{ margin: '12px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
              {item.verdict.evidence.map(ev => <li key={ev} style={{ font: '500 13px/1.5 var(--font-sans)', paddingLeft: 14, position: 'relative' }}><span style={{ position: 'absolute', left: 0, top: 0 }}>·</span>{ev}</li>)}
            </ul>
          )}
        </Card>

        <CaseAi item={item} />

        <div>
          <SectionHeading>{l.trialStartAt ? 'First 7 days of the trial' : 'Since signing up'}</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            <StatBlock label="Emails" value={e.emailsSent} />
            <StatBlock label="Replies" value={e.repliesReceived} />
            <StatBlock label="Videos" value={e.videosCreated} />
            <StatBlock label="Active" value={e.activeDays === 1 ? '1 day' : `${e.activeDays} days`} />
          </div>
          <SectionHeading style={{ marginTop: 14 }}>All time</SectionHeading>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            <StatBlock label="Emails" value={e.lifetime.emailsSent} />
            <StatBlock label="Replies" value={e.lifetime.repliesReceived} />
            <StatBlock label="Campaigns" value={e.lifetime.campaignsCreated} />
            <StatBlock label="Videos" value={e.lifetime.videosPublished ? `${e.lifetime.videosCreated} · ${e.lifetime.videosPublished} live` : e.lifetime.videosCreated} />
          </div>
        </div>

        <div>
          <SectionHeading>Timeline</SectionHeading>
          <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {timeline.map((m, i) => (
              <div key={m.label + m.at} style={{ ...row, borderTop: i ? row.borderTop : 0 }}>
                <span style={{ color: m.tone === 'bad' ? 'var(--red-600)' : m.tone === 'good' ? 'var(--green-600)' : 'inherit', fontWeight: m.tone ? 600 : 400 }}>{m.label}</span>
                <span style={{ color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{shortDate(m.at)}</span>
              </div>
            ))}
            {l.daysToCancel !== null && <p style={{ margin: 0, padding: '8px 0 4px', borderTop: row.borderTop, font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{l.outcome === 'payment_failed' ? 'Card failed' : 'Canceled'} {days(l.daysToCancel)} after the trial started{e.daysSilentBeforeEnd !== null && e.daysSilentBeforeEnd > 0 ? `, quiet for the last ${days(e.daysSilentBeforeEnd)}` : ''}.</p>}
          </Card>
        </div>

        <div>
          <SectionHeading>Stripe</SectionHeading>
          <Card padding="wide" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {l.stripe ? (
              <>
                <div style={{ ...row, borderTop: 0 }}><span>Status</span><span style={{ color: 'var(--text-secondary)' }}>{l.stripe.status.replace(/_/g, ' ')}</span></div>
                <div style={row}><span>Charged</span><span style={{ color: 'var(--text-secondary)' }}>{l.stripe.chargedCents ? money(l.stripe.chargedCents) : 'Never charged'}{l.stripe.refunded ? ' · refunded' : ''}</span></div>
                {l.stripe.cancelReason && <div style={row}><span>Cancel reason</span><span style={{ color: 'var(--text-secondary)' }}>{l.stripe.cancelReason.replace(/_/g, ' ')}</span></div>}
                {l.stripe.cancelFeedback && <div style={row}><span>Their feedback</span><span style={{ color: 'var(--text-secondary)' }}>{l.stripe.cancelFeedback.replace(/_/g, ' ')}</span></div>}
                {l.stripe.cancelComment && <p style={{ margin: 0, padding: '8px 0', borderTop: row.borderTop, font: '500 13px/1.5 var(--font-sans)', fontStyle: 'italic' }}>&ldquo;{l.stripe.cancelComment}&rdquo;</p>}
              </>
            ) : (
              <p style={{ margin: 0, padding: '8px 0', font: '400 13px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{l.trialStartAt ? 'No Stripe subscription matched this athlete.' : 'Never reached Stripe.'}</p>
            )}
          </Card>
        </div>

        {play && (
          <div>
            <SectionHeading>What to do</SectionHeading>
            <Card padding="wide">
              <p style={{ margin: 0, font: '600 14px/1.5 var(--font-sans)' }}>{play.action}</p>
              <p style={{ margin: '6px 0 0', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{play.why}</p>
            </Card>
          </div>
        )}

        {l.warnings.length > 0 && (
          <div>
            <SectionHeading>Data warnings</SectionHeading>
            <Card padding="wide" style={{ background: 'var(--amber-100)', borderColor: 'var(--amber-200)' }}>
              {l.warnings.map(w => <p key={w} style={{ margin: 0, font: '400 12px/1.6 var(--font-sans)', color: 'var(--amber-800)' }}>{w}</p>)}
            </Card>
          </div>
        )}
      </div>
    </main>
  );
}
