'use server';

import { markSent } from '@/lib/checkins';

/** Logs that the founder opened Messages for this user. Nothing is sent by the server. */
export async function markCheckinSent(userId: string, variation: number): Promise<void> {
  await markSent(userId, variation);
}
