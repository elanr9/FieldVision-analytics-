'use client';

import { useState } from 'react';
import {
  OUTREACH_EMAIL_SUBJECT,
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
  const [emailOpen, setEmailOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const base =
    size === 'lg'
      ? 'flex-1 rounded-xl py-3 text-center text-sm font-semibold active:scale-[0.98]'
      : 'flex min-h-9 min-w-14 items-center justify-center rounded-lg px-3 py-2 text-center text-xs font-semibold active:scale-95';

  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const onTrial = Boolean(user.trialStartedAt);
  const phone = user.phone;
  const email = user.email;
  const body = outreachEmailBody(user.name, onTrial);

  const copyEmail = async () => {
    if (!email) return;
    const text = `To: ${email}\nSubject: ${OUTREACH_EMAIL_SUBJECT}\n\n${body}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <div className={`flex items-center gap-1.5 ${size === 'lg' ? 'w-full' : ''}`}>
        {phone && (
          <>
            <a
              href={smsHref(phone, outreachSmsBody(user.name, onTrial))}
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
          <button
            type="button"
            onClick={e => {
              stop(e);
              setEmailOpen(true);
              setCopied(false);
            }}
            className={`${base} bg-neutral-100 text-neutral-700 hover:bg-neutral-200`}
          >
            Email
          </button>
        )}
        {!phone && !email && (
          <span className="text-xs text-neutral-400">No contact info</span>
        )}
      </div>

      {emailOpen && email && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center"
          onClick={e => {
            stop(e);
            setEmailOpen(false);
          }}
        >
          <div
            className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl sm:rounded-2xl sm:p-5"
            onClick={stop}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Email template</p>
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
              >
                Close
              </button>
            </div>

            <div className="mt-3 space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
              <p>
                <span className="font-medium text-neutral-500">To </span>
                {email}
              </p>
              <p>
                <span className="font-medium text-neutral-500">Subject </span>
                {OUTREACH_EMAIL_SUBJECT}
              </p>
            </div>

            <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-neutral-200 bg-white p-3 text-sm leading-relaxed text-neutral-800">
              {body}
            </pre>

            <button
              type="button"
              onClick={copyEmail}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:scale-[0.98]"
            >
              {copied ? 'Copied' : 'Copy email'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
