import { NextResponse } from 'next/server';
import { loadCachedConversion } from '@/lib/conversion/server-cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Every case with its verdict, loaded when the Conversion tab opens so the home page stays fast. Protected by the password middleware. */
export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get('refresh') === '1';
  try {
    const { data } = await loadCachedConversion(refresh);
    return NextResponse.json(data, { headers: { 'cache-control': 'no-store' } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
