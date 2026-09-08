import React from 'react';

export type UserStatus = 'paying' | 'comped' | 'trialing' | 'trial_ended' | 'signed_up' | 'churned';

export interface StatusBadgeProps {
  status: UserStatus;
  interval?: string;
}

export const STATUS_LABEL: Record<UserStatus, string> = { paying: 'Paying', comped: 'Comped', trialing: 'Trialing', trial_ended: 'Trial ended', signed_up: 'Signed up', churned: 'Churned' };
const TOKEN: Record<UserStatus, string> = { paying: 'paying', comped: 'comped', trialing: 'trialing', trial_ended: 'trial-ended', signed_up: 'signed-up', churned: 'churned' };

/** Pill showing a user's single status. Paying users get " · monthly|annual|lifetime". */
export function StatusBadge({ status, interval }: StatusBadgeProps) {
  const k = TOKEN[status] || 'signed-up';
  const suffix = status === 'paying' && interval && interval !== 'unknown' ? ' · ' + interval : '';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', borderRadius: 'var(--radius-full)', padding: '2px 8px', font: '600 11px/1.5 var(--font-sans)', whiteSpace: 'nowrap', background: `var(--status-${k}-bg)`, color: `var(--status-${k}-fg)` }}>{STATUS_LABEL[status] || status}{suffix}</span>
  );
}
