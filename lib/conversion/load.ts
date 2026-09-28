import type { UserRecord } from '../types';
import { loadLifecycles } from './lifecycle';
import { buildCases, type ConversionData } from './report';

/** Server side entry point: every case with its verdict plus Stripe availability. Read only. */
export async function loadConversionData(users: UserRecord[], now: Date = new Date()): Promise<ConversionData> {
  const { lifecycles, stripe } = await loadLifecycles(users, now);
  return { cases: buildCases(lifecycles), stripe, generatedAt: now.toISOString() };
}
