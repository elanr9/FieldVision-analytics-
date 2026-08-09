'use client';

import { useEffect, useState } from 'react';
import { daysAgo, mailtoHref } from '@/lib/contact';
import { formatDay } from '@/lib/dates';
import type { UserDossier as Dossier } from '@/lib/user-dossier';
import { PIPELINE_META, type UserRecord } from '@/lib/types';
import ContactActions from './ContactActions';
import StatusBadge from './StatusBadge';
import UserDossier from './UserDossier';

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

/** Slide-over with everything about one user plus outreach actions. */
export default function UserDetail({
  user,
  onClose,
}: {
  user: UserRecord;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [dossierLoading, setDossierLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSummary(null);
    setSummaryLoading(true);
    fetch('/api/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then((data: { summary?: string } | null) => {
        if (!cancelled) setSummary(data?.summary ?? null);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setDossier(null);
    setDossierLoading(true);
    fetch(`/api/dossier?userId=${encodeURIComponent(user.id)}`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: Dossier | null) => {
        if (!cancelled) setDossier(data);
      })
      .catch(() => {
        if (!cancelled) setDossier(null);
      })
      .finally(() => {
        if (!cancelled) setDossierLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const pipelineMeta = user.pipeline ? PIPELINE_META[user.pipeline] : null;

  const journey: { label: string; date: string }[] = [
    { label: 'Signed up', date: user.signupDate },
  ];
  if (user.trialStartedAt) journey.push({ label: 'Trial started', date: user.trialStartedAt });
  if (user.trialEndsAt && user.status !== 'paying') {
    const ended = new Date(user.trialEndsAt).getTime() < Date.now();
    journey.push({ label: ended ? 'Trial ended' : 'Trial ends', date: user.trialEndsAt });
  }
  if (user.paidAt) {
    journey.push({
      label: user.status === 'churned' ? 'Last payment' : 'Paid',
      date: user.paidAt,
    });
  }
  journey.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{user.name}</h2>
            <p className="truncate text-sm text-neutral-500">{user.email || 'No email'}</p>
            {user.phone && <p className="text-sm text-neutral-500">{user.phone}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-neutral-100 px-3 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={user.status} interval={user.interval} />
          {user.isParent && (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500">
              Parent account
            </span>
          )}
          {user.excludedFromMetrics && (
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] font-semibold text-white">
              Internal
            </span>
          )}
        </div>

        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
            The rundown
          </p>
          {summaryLoading ? (
            <div className="mt-1.5 space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded bg-emerald-100" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-emerald-100" />
            </div>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-neutral-800">
              {summary ?? 'Could not load a summary for this user.'}
            </p>
          )}
        </div>

        {pipelineMeta && (
          <div className="mt-3 rounded-xl bg-neutral-50 p-3">
            <p className="text-sm font-semibold">{pipelineMeta.title}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{pipelineMeta.hint}</p>
          </div>
        )}

        <div className="mt-4">
          <ContactActions user={user} size="lg" />
        </div>

        {user.parentEmail && (
          <a
            href={mailtoHref(user.parentEmail)}
            className="mt-2 block w-full rounded-xl bg-neutral-100 py-2.5 text-center text-sm font-semibold text-neutral-700 hover:bg-neutral-200"
          >
            Email parent{user.parentName ? ` (${user.parentName})` : ''}
          </a>
        )}

        <div className="mt-5 divide-y divide-neutral-100 rounded-xl border border-neutral-200 px-4">
          <Row label="Team" value={user.team} />
          <Row label="Position" value={user.position} />
          <Row label="Grad year" value={user.gradYear ? String(user.gradYear) : null} />
          <Row
            label="Onboarding"
            value={
              user.onboarding === 'completed'
                ? 'Completed'
                : user.onboarding === 'in_progress'
                  ? `In progress (step ${(user.onboardingStepIndex ?? 0) + 1})`
                  : 'Never started'
            }
          />
          <Row label="Plan type" value={user.paymentType} />
          <Row label="Parent" value={user.parentName} />
          <Row label="Parent email" value={user.parentEmail} />
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
            Journey
          </p>
          <ol className="space-y-2">
            {journey.map(step => (
              <li key={step.label} className="flex items-center gap-3">
                <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium">{step.label}</span>
                <span className="ml-auto text-xs text-neutral-500">
                  {formatDay(step.date)} · {daysAgo(step.date)}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {dossierLoading ? (
          <div className="mt-5 space-y-2">
            <div className="h-16 animate-pulse rounded-xl bg-neutral-100" />
            <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
            <div className="h-28 animate-pulse rounded-xl bg-neutral-100" />
          </div>
        ) : dossier ? (
          <UserDossier dossier={dossier} />
        ) : (
          <p className="mt-5 text-sm text-neutral-400">Could not load full profile.</p>
        )}
      </div>
    </div>
  );
}
