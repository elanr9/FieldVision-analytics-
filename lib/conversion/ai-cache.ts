import { createClient } from '@supabase/supabase-js';

/**
 * Durable cache for model outputs in analytics_ai_cache. Vercel functions are ephemeral, so an in
 * memory cache alone would rerun the diagnosis on every cold start. Rows are keyed by purpose and
 * carry the data fingerprint they were computed from, so callers can tell fresh from stale.
 */
export interface CachedValue<T> {
  value: T;
  fingerprint: string | null;
  updatedAt: string;
}

interface Row {
  value: unknown;
  fingerprint: string | null;
  updated_at: string;
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function readAiCache<T>(key: string): Promise<CachedValue<T> | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase.from('analytics_ai_cache').select('value, fingerprint, updated_at').eq('key', key).maybeSingle();
  if (error || !data) return null;
  const row = data as Row;
  return { value: row.value as T, fingerprint: row.fingerprint, updatedAt: row.updated_at };
}

export async function writeAiCache<T>(key: string, value: T, fingerprint: string | null): Promise<void> {
  const supabase = client();
  if (!supabase) return;
  await supabase.from('analytics_ai_cache').upsert({ key, value, fingerprint, updated_at: new Date().toISOString() });
}

/** Short stable hash for cache keys built from free text. */
export function shortHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
