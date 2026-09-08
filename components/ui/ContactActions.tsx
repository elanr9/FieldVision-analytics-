'use client';
import React from 'react';
import { Button } from './Button';

export interface ContactActionsProps { phone?: string | null; email?: string | null; size?: 'sm' | 'lg'; onText?: () => void; onCall?: () => void; onEmail?: () => void; }

/** Text / Call / Email button group. Text is green; Call and Email are gray. size sm for rows, lg for the profile. */
export function ContactActions({ phone, email, size = 'sm', onText, onCall, onEmail }: ContactActionsProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (!phone && !email) return <span style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>No contact info</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: size === 'lg' ? '100%' : undefined }}>
      {phone && <Button size={size} block={size === 'lg'} variant="money" href={onText ? undefined : 'sms:' + phone} onClick={e => { stop(e); onText && onText(); }}>Text</Button>}
      {phone && <Button size={size} block={size === 'lg'} variant="secondary" href={onCall ? undefined : 'tel:' + phone} onClick={e => { stop(e); onCall && onCall(); }}>Call</Button>}
      {email && <Button size={size} block={size === 'lg'} variant="secondary" href={onEmail ? undefined : 'mailto:' + email} onClick={e => { stop(e); onEmail && onEmail(); }}>Email</Button>}
    </div>
  );
}
