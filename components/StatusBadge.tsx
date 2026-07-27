import { STATUS_LABEL, type PlanInterval, type UserStatus } from '@/lib/types';

const STYLES: Record<UserStatus, string> = {
  paying: 'bg-emerald-100 text-emerald-800',
  comped: 'bg-neutral-200 text-neutral-600',
  trialing: 'bg-sky-100 text-sky-800',
  trial_ended: 'bg-amber-100 text-amber-800',
  signed_up: 'bg-neutral-100 text-neutral-500',
  churned: 'bg-red-100 text-red-700',
};

const INTERVAL_LABEL: Record<PlanInterval, string> = {
  monthly: 'monthly',
  annual: 'annual',
  lifetime: 'lifetime',
  unknown: '',
};

export default function StatusBadge({
  status,
  interval,
}: {
  status: UserStatus;
  interval: PlanInterval;
}) {
  const suffix = status === 'paying' && INTERVAL_LABEL[interval] ? ` · ${INTERVAL_LABEL[interval]}` : '';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
      {suffix}
    </span>
  );
}
