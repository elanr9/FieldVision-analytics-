'use client';

import {
  OUTREACH_EMAIL_SUBJECT,
  gmailComposeHref,
  outreachEmailBody,
  outreachSmsBody,
  smsHref,
  telHref,
} from '@/lib/contact';
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
      ? 'flex-1 rounded-xl py-3 text-center text-sm font-semibold active:scale-[0.98]'
      : 'flex min-h-9 min-w-14 items-center justify-center rounded-lg px-3 py-2 text-center text-xs font-semibold active:scale-95';

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const onTrial = Boolean(user.trialStartedAt);
  const cancelled = user.status === 'churned';
  const phone = user.phone;
  const email = user.email;
  const body = outreachEmailBody(user.name, onTrial, cancelled);

  return (
    <div className={`flex items-center gap-1.5 ${size === 'lg' ? 'w-full' : ''}`}>
      {phone && (
        <>
          <a
            href={smsHref(phone, outreachSmsBody(user.name, onTrial, cancelled))}
            onClick={stop}
            className={`${base} bg-emerald-600 text-white hover:bg-emerald-700`}
          >
            Text
          </a>
          <a
            href={telHref(phone)}
            onClick={stop}
            className={`${base} bg-neutral-100 text-neutral-700 hover:bg-neutral-200`}
          >
            Call
          </a>
        </>
      )}
      {email && (
        <a
          href={gmailComposeHref(email, {
            subject: OUTREACH_EMAIL_SUBJECT,
            body,
          })}
          onClick={stop}
          className={`${base} bg-neutral-100 text-neutral-700 hover:bg-neutral-200`}
        >
          Email
        </a>
      )}
      {!phone && !email && (
        <span className="text-xs text-neutral-400">No contact info</span>
      )}
    </div>
  );
}
