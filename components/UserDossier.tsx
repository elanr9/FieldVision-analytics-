'use client';

import type { ReactNode } from 'react';
import { daysAgo } from '@/lib/contact';
import { formatDay } from '@/lib/dates';
import {
  formatHeight,
  type UserDossier as Dossier,
} from '@/lib/user-dossier';

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-5">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">{title}</p>
        {typeof count === 'number' && (
          <span className="text-[11px] font-semibold text-neutral-400">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="text-sm text-neutral-400">{label}</p>;
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-neutral-50 px-3 py-2.5 text-center">
      <p className="text-lg font-bold tabular-nums text-neutral-900">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className="max-w-[60%] text-right text-sm font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (s.includes('download') || s.includes('publish') || s.includes('ready') || s === 'completed') {
    return 'bg-emerald-50 text-emerald-700';
  }
  if (s.includes('fail') || s.includes('error') || s.includes('cancel')) {
    return 'bg-red-50 text-red-700';
  }
  return 'bg-neutral-100 text-neutral-600';
}

/** Rich athlete dossier sections loaded into the user profile sheet. */
export default function UserDossier({ dossier }: { dossier: Dossier }) {
  const bg = dossier.background;
  const location =
    bg?.homeCity || bg?.homeState
      ? [bg.homeCity, bg.homeState].filter(Boolean).join(', ')
      : null;
  const size =
    bg?.heightIn || bg?.weightLb
      ? [formatHeight(bg.heightIn ?? null), bg.weightLb ? `${bg.weightLb} lb` : null]
          .filter(Boolean)
          .join(' · ')
      : null;
  const academics = [
    bg?.gpaUnweighted != null ? `GPA ${bg.gpaUnweighted}` : null,
    bg?.gpaWeighted != null ? `wGPA ${bg.gpaWeighted}` : null,
    bg?.satTotal != null ? `SAT ${bg.satTotal}` : null,
    bg?.actComposite != null ? `ACT ${bg.actComposite}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div>
      <Section title="Activity">
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Emails" value={dossier.stats.emailsSent} />
          <Stat label="Replies" value={dossier.stats.replies} />
          <Stat label="HL views" value={dossier.stats.coachViews} />
          <Stat label="Calls" value={dossier.stats.callsBooked} />
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          {dossier.stats.emailsOpened} opens · {dossier.stats.uniqueCoachesWatched} coaches watched
          highlights · {dossier.stats.videosPublished}/{dossier.stats.videos} videos published
        </p>
      </Section>

      <Section title="Background">
        {bg ? (
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-3">
            <Meta label="Club" value={bg.clubTeam} />
            <Meta
              label="Position"
              value={
                [bg.position, bg.secondaryPosition].filter(Boolean).join(' / ') || null
              }
            />
            <Meta label="Grad year" value={bg.gradYear ? String(bg.gradYear) : null} />
            <Meta label="High school" value={bg.highSchool} />
            <Meta label="Hometown" value={location} />
            <Meta label="Size" value={size} />
            <Meta label="Foot" value={bg.dominantFoot} />
            <Meta label="Level" value={[bg.leagueLevel, bg.starterStatus].filter(Boolean).join(' · ') || null} />
            <Meta label="Academics" value={academics || null} />
            <Meta
              label="Majors"
              value={bg.intendedMajors.length ? bg.intendedMajors.join(', ') : null}
            />
            <Meta
              label="Divisions"
              value={bg.divisionPreference.length ? bg.divisionPreference.join(', ') : null}
            />
            <Meta
              label="States"
              value={bg.preferredStates.length ? bg.preferredStates.join(', ') : null}
            />
            <Meta label="Dream schools" value={bg.dreamSchools} />
            <Meta label="Recruiting" value={bg.recruitingStartStatus} />
            <Meta
              label="Prior outreach"
              value={
                bg.schoolsContactedCount != null
                  ? `${bg.schoolsContactedCount} contacted · ${bg.schoolsRespondedCount ?? 0} replies · ${bg.offersCount ?? 0} offers`
                  : null
              }
            />
            {bg.highlightVideoUrl && (
              <div className="py-2">
                <a
                  href={bg.highlightVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  Onboarding highlight link
                </a>
              </div>
            )}
          </div>
        ) : (
          <Empty label="No onboarding background yet" />
        )}
      </Section>

      <Section title="Highlight videos" count={dossier.videos.length}>
        {dossier.videos.length === 0 ? (
          <Empty label="No highlight projects" />
        ) : (
          <ul className="space-y-2">
            {dossier.videos.map(video => (
              <li
                key={video.id}
                className="rounded-xl border border-neutral-200 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-snug text-neutral-900">
                    {video.title}
                  </p>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(video.status)}`}
                  >
                    {video.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatDay(video.createdAt)} · {daysAgo(video.createdAt)} ·{' '}
                  {video.uniqueCoaches} coaches · {video.coachViews} views
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {video.youtubeUrl && (
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-neutral-900 px-2.5 py-1 text-xs font-semibold text-white"
                    >
                      YouTube
                    </a>
                  )}
                  {video.downloadUrl && (
                    <a
                      href={video.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700"
                    >
                      Download
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Calls booked" count={dossier.calls.length}>
        {dossier.calls.length === 0 ? (
          <Empty label="No ambassador calls booked" />
        ) : (
          <ul className="space-y-2">
            {dossier.calls.map(call => (
              <li
                key={call.id}
                className="rounded-xl border border-neutral-200 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {call.ambassadorName || 'Ambassador call'}
                  </p>
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${statusTone(call.status)}`}
                  >
                    {call.status}
                  </span>
                </div>
                {call.startAt && (
                  <p className="mt-1 text-xs text-neutral-500">
                    {formatDay(call.startAt)} · {daysAgo(call.startAt)}
                  </p>
                )}
                {call.note && (
                  <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{call.note}</p>
                )}
                {call.meetLink && (
                  <a
                    href={call.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Meet link
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Coach replies" count={dossier.stats.replies}>
        {dossier.replies.length === 0 ? (
          <Empty label="No coach replies yet" />
        ) : (
          <ul className="space-y-2">
            {dossier.replies.map(reply => (
              <li
                key={reply.id}
                className="rounded-xl border border-neutral-200 px-3 py-2.5"
              >
                <p className="text-sm font-semibold">
                  {reply.coachName || reply.coachEmail || 'Coach'}
                </p>
                <p className="text-xs text-neutral-500">
                  {[reply.schoolName, formatDay(reply.repliedAt), daysAgo(reply.repliedAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {reply.preview && (
                  <p className="mt-1.5 text-xs leading-relaxed text-neutral-700">
                    {reply.preview}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Recent emails" count={dossier.stats.emailsSent}>
        {dossier.recentEmails.length === 0 ? (
          <Empty label="No coach emails sent" />
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {dossier.recentEmails.map(email => (
              <li key={email.id} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {email.coachName || email.coachEmail || 'Coach'}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {[email.schoolName, email.subject].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-neutral-400">
                      {email.sentAt ? daysAgo(email.sentAt) : '—'}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                      {email.replied ? 'Replied' : email.opened ? `Opened ×${email.openCount}` : 'Sent'}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Coaches who watched" count={dossier.stats.uniqueCoachesWatched}>
        {dossier.topViewers.length === 0 ? (
          <Empty label="No highlight views tracked yet" />
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
            {dossier.topViewers.map(viewer => (
              <li key={viewer.coachEmail} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{viewer.coachEmail}</p>
                  <p className="truncate text-xs text-neutral-500">
                    {viewer.schoolName || 'Unknown school'}
                    {viewer.lastOpenedAt ? ` · ${daysAgo(viewer.lastOpenedAt)}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs font-semibold text-neutral-600">
                  <p>×{viewer.openCount}</p>
                  {viewer.maxWatchPct != null && (
                    <p className="text-[10px] font-medium text-neutral-400">
                      {Math.round(Number(viewer.maxWatchPct))}% watched
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
