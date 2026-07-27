'use client';

import { mailtoHref, smsHref, telHref } from '@/lib/contact';
import type { UserRecord } from '@/lib/types';

/** Text, call, and email buttons. Stops row click propagation so they work inside clickable cards. */
export default function ContactActions({
  user,
  size = 'sm',
}: {
  user: UserRecord;
  size?: 'sm' | 'lg';
}) {
  const base =
    size === 'lg'
      ? 'flex-1 rounded-xl py-2.5 text-center text-sm font-semibold'
      : 'rounded-lg px-2.5 py-1.5 text-center text-xs font-semibold';

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div className={`flex items-center gap-1.5 ${size === 'lg' ? 'w-full' : ''}`}>
      {user.phone && (
        <>
          <a
            href={smsHref(user.phone)}
            onClick={stop}
            className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Text
          </a>
          <a
            href={telHref(user.phone)}
            onClick={stop}
            className={`${base} bg-neutral-100 text-neutral-700 hover:bg-neutral-200`}
          >
            Call
          </a>
        </>
      )}
      {user.email && (
        <a
          href={mailtoHref(user.email)}
          onClick={stop}
          className={`${base} bg-neutral-100 text-neutral-700 hover:bg-neutral-200`}
        >
          Email
        </a>
      )}
      {!user.phone && !user.email && (
        <span className="text-xs text-neutral-400">No contact info</span>
      )}
    </div>
  );
}
