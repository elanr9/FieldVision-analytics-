import type { UserRecord } from '@/lib/types';

function pct(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

/**
 * Cohort funnel: of the real users who signed up in the selected range, how
 * many ever started a trial, and how many are paying now.
 */
export default function Funnel({ cohort }: { cohort: UserRecord[] }) {
  const signedUp = cohort.length;
  const trialStarted = cohort.filter(u => u.trialStartedAt).length;
  const paid = cohort.filter(u => u.status === 'paying').length;

  const steps = [
    { label: 'Signed up', count: signedUp, sub: '100%' },
    { label: 'Trial started', count: trialStarted, sub: `${pct(trialStarted, signedUp)} of signups` },
    { label: 'Paying', count: paid, sub: `${pct(paid, signedUp)} of signups` },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {steps.map((step, i) => (
        <div key={step.label} className="rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-[11px]">
            {step.label}
          </p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${
              i === 2 ? 'text-emerald-600' : ''
            }`}
          >
            {step.count}
          </p>
          <p className="mt-1 text-[10px] text-neutral-500 sm:text-xs">{step.sub}</p>
        </div>
      ))}
    </div>
  );
}
