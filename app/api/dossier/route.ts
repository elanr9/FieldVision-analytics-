import { NextResponse, type NextRequest } from 'next/server';
import { loadUserDossier } from '@/lib/user-dossier';

export const dynamic = 'force-dynamic';

/** Protected by the password middleware. Returns the full athlete dossier. */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  try {
    const dossier = await loadUserDossier(userId);
    return NextResponse.json(dossier);
  } catch (err) {
    console.error('Dossier load failed', err);
    return NextResponse.json({ error: 'Failed to load dossier' }, { status: 500 });
  }
}
