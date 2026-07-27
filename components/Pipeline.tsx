'use client';

import { useMemo } from 'react';
import { daysAgo, hoursUntil } from '@/lib/contact';
import {
  PIPELINE_META,
  PIPELINE_ORDER,
  type PipelineStage,
  type UserRecord,
} from '@/lib/types';
import ContactActions from './ContactActions';

function UserCard({
  user,
  note,
  onSelect,
}: {
  user: UserRecord;
  note: string;
  onSelect: (u: UserRecord) => void;
}) {
  const facts = [user.team, user.gradYear ? `'${String(user.gradYear).slice(-2)}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(user)}
        className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-neutral-50 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {user.name}
            {facts && <span className="ml-2 font-normal text-neutral-500">{facts}</span>}
          </p>
          <p className="truncate text-xs text-neutral-500">{note}</p>
        </div>
        <ContactActions user={user} />
      </button>
    </li>
  );
}

function cardNote(user: UserRecord, stage: PipelineStage): string {
  switch (stage) {
    case 'trial_ending_soon': {
      const h = user.trialEndsAt ? hoursUntil(user.trialEndsAt) : 0;
      return h > 0 ? `Trial ends in ${h}h` : 'Trial ends today';
    }
    case 'trial_lost':
      return user.trialEndsAt
        ? `Trial ended ${daysAgo(user.trialEndsAt)}, never charged`
        : 'Trial ended, never charged';
    case 'stopped_at_paywall':
      return `Finished onboarding ${daysAgo(user.signupDate)}, never started trial`;
    case 'churned':
      return user.paidAt ? `Last paid ${daysAgo(user.paidAt)}` : 'Canceled after paying';
    case 'in_onboarding':
      return `Stuck at step ${(user.onboardingStepIndex ?? 0) + 1} · signed up ${daysAgo(user.signupDate)}`;
    case 'never_onboarded':
      return `Signed up ${daysAgo(user.signupDate)}, no activity`;
  }
}

/** Sales pipeline: everyone worth reaching out to, grouped by why. */
export default function Pipeline({
  users,
  onSelect,
}: {
  users: UserRecord[];
  onSelect: (u: UserRecord) => void;
}) {
  const buckets = useMemo(() => {
    const map = new Map<PipelineStage, UserRecord[]>();
    for (const stage of PIPELINE_ORDER) map.set(stage, []);
    for (const u of users) {
      if (u.pipeline) map.get(u.pipeline)?.push(u);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(b.signupDate).getTime() - new Date(a.signupDate).getTime());
    }
    return map;
  }, [users]);

  const total = [...buckets.values()].reduce((s, l) => s + l.length, 0);

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        {total} people worth a follow up. Tap a person for full details, or text them straight
        from the list.
      </p>
      {PIPELINE_ORDER.map(stage => {
        const list = buckets.get(stage) ?? [];
        if (list.length === 0) return null;
        const meta = PIPELINE_META[stage];
        return (
          <section key={stage} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4 py-3">
              <span className={`h-2.5 w-2.5 rounded-full ${meta.accent}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">
                  {meta.title} <span className="font-normal text-neutral-400">· {list.length}</span>
                </p>
                <p className="text-xs text-neutral-500">{meta.hint}</p>
              </div>
            </div>
            <ul className="divide-y divide-neutral-100">
              {list.map(u => (
                <UserCard key={u.id} user={u} note={cardNote(u, stage)} onSelect={onSelect} />
              ))}
            </ul>
          </section>
        );
      })}
      {total === 0 && (
        <p className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          Nobody needs a follow up right now.
        </p>
      )}
    </div>
  );
}
