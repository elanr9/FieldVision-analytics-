import type { UserRecord } from '@/lib/types';

function pct(part: number, whole: number): string {
  if (whole === 0) return '0%';
  return `${Math.round((part / whole) * 1000) / 10}%`;
}

/**
 * Cohort funnel: of the real users who signed up in the selected range, how
 * many ever started a trial, and how many are paying now.
 */
export default function Funnel({
  cohort,
  selectedKey,
  onPick,
}: {
  cohort: UserRecord[];
  selectedKey: string;
  onPick: (key: string, title: string, users: UserRecord[]) => void;
}) {
  const trialUsers = cohort.filter(u => u.trialStartedAt);
  const paidUsers = cohort.filter(u => u.status === 'paying');

  const steps = [
    { key: 'funnel-signed-up', label: 'Signed up', users: cohort, sub: '100%', accent: false },
    {
      key: 'funnel-trial',
      label: 'Trial started',
      users: trialUsers,
      sub: `${pct(trialUsers.length, cohort.length)} of signups`,
      accent: false,
    },
    {
      key: 'funnel-paying',
      label: 'Paying',
      users: paidUsers,
      sub: `${pct(paidUsers.length, cohort.length)} of signups`,
      accent: true,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {steps.map(step => (
        <button
          key={step.key}
          type="button"
          onClick={() => onPick(step.key, step.label, step.users)}
          className={`rounded-2xl border bg-white p-3 text-left sm:p-4 ${
            selectedKey === step.key ? 'border-neutral-900' : 'border-neutral-200'
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 sm:text-[11px]">
            {step.label}
          </p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${
              step.accent ? 'text-emerald-600' : ''
            }`}
          >
            {step.users.length}
          </p>
          <p className="mt-1 text-[10px] text-neutral-500 sm:text-xs">{step.sub}</p>
        </button>
      ))}
    </div>
  );
}
