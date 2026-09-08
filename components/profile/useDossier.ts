'use client';

import { useEffect, useState } from 'react';
import type { UserDossier } from '@/lib/user-dossier';

/** Loads one user's dossier from the existing /api/dossier route. Pass null to skip. */
export function useDossier(userId: string | null): { dossier: UserDossier | null; loading: boolean } {
  const [dossier, setDossier] = useState<UserDossier | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  useEffect(() => {
    setDossier(null);
    if (!userId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/dossier?userId=${encodeURIComponent(userId)}`)
      .then(res => (res.ok ? res.json() : null))
      .then((data: UserDossier | null) => { if (!cancelled) setDossier(data); })
      .catch(() => { if (!cancelled) setDossier(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);
  return { dossier, loading };
}
