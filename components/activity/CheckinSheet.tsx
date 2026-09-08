'use client';

import { Sheet } from '@/components/motion/Sheet';
import { Button } from '@/components/ui/Button';
import { CHECKIN_TEXTS, checkinText, checkinVariation, firstName, type CheckinLogRow } from '@/lib/checkins';
import type { UserRecord } from '@/lib/types';

/** iOS Messages accepts `sms:number&body=`; Android expects `?body=`. */
export function smsHref(phone: string, body: string): string {
  const android = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent);
  return `sms:${phone}${android ? '?' : '&'}body=${encodeURIComponent(body)}`;
}

export interface CheckinSheetProps {
  user: UserRecord | null;
  checkinLog: CheckinLogRow[];
  onClose: () => void;
  /** Called after Messages opens, with the variation that was used. */
  onSent: (user: UserRecord, variation: number) => void;
}

export function CheckinSheet({ user, checkinLog, onClose, onSent }: CheckinSheetProps) {
  const variation = user ? checkinVariation(user, checkinLog) : 0;
  const text = user ? checkinText(user, checkinLog) : '';

  const openMessages = () => {
    if (!user || !user.phone) return;
    window.location.href = smsHref(user.phone, text);
    onSent(user, variation);
    onClose();
  };

  return (
    <Sheet open={user !== null} onClose={onClose}>
      {user && <>
        <p style={{ margin: 0, font: '600 15px/1.3 var(--font-sans)' }}>Text {firstName(user)}</p>
        <p style={{ margin: '2px 0 12px', font: '400 12px/1.5 var(--font-sans)', color: 'var(--text-secondary)' }}>{user.phone} · variation {variation + 1} of {CHECKIN_TEXTS.length}</p>
        <div style={{ background: 'var(--ink-700)', color: '#fff', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', font: '400 15px/1.45 var(--font-sans)', maxWidth: '85%' }}>{text}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <Button variant="secondary" block onClick={onClose}>Not now</Button>
          <Button variant="money" block onClick={openMessages}>Open Messages</Button>
        </div>
      </>}
    </Sheet>
  );
}
