'use client';
import React from 'react';
import { Button } from './Button';

export interface ContactActionsProps { phone?: string | null; email?: string | null; size?: 'sm' | 'lg'; onText?: () => void; onCall?: () => void; onEmail?: () => void; emphasize?: 'call'; }

/** Text / Call / Email button group. Text is green; Call and Email are gray. size sm for rows, lg for the profile. */
export function ContactActions({ phone, email, size = 'sm', onText, onCall, onEmail, emphasize }: ContactActionsProps) {
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (!phone && !email) return <span style={{ font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-tertiary)' }}>No contact info</span>;
  const callBtn = phone ? <Button size={size} block={size === 'lg'} variant={emphasize === 'call' ? 'money' : 'secondary'} href={onCall ? undefined : 'tel:' + phone} style={emphasize === 'call' ? { boxShadow: '0 0 0 3px var(--focus-ring)' } : undefined} onClick={e => { stop(e); onCall && onCall(); }}>Call</Button> : null;
  const textBtn = phone ? <Button size={size} block={size === 'lg'} variant={emphasize === 'call' ? 'secondary' : 'money'} href={onText ? undefined : 'sms:' + phone} onClick={e => { stop(e); onText && onText(); }}>Text</Button> : null;
  const emailBtn = email ? <Button size={size} block={size === 'lg'} variant="secondary" href={onEmail ? undefined : 'mailto:' + email} onClick={e => { stop(e); onEmail && onEmail(); }}>Email</Button> : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: size === 'lg' ? '100%' : undefined }}>
      {emphasize === 'call' ? <>{callBtn}{textBtn}{emailBtn}</> : <>{textBtn}{callBtn}{emailBtn}</>}
    </div>
  );
}
