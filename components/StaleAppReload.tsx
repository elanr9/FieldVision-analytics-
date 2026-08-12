'use client';

import { useEffect } from 'react';

/**
 * The iOS shell keeps the loaded page alive across app suspensions, so users
 * can run days-old JavaScript. When the app becomes visible again, compare the
 * running build against the server's and reload if a new deploy shipped.
 */
export default function StaleAppReload() {
  useEffect(() => {
    async function checkVersion() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        const data: { id: string | null } = await res.json();
        if (data.id && data.id !== process.env.NEXT_PUBLIC_BUILD_ID) {
          window.location.reload();
        }
      } catch {
        // Offline or request failed. Try again on the next resume.
      }
    }

    function onVisible() {
      if (document.visibilityState === 'visible') void checkVersion();
    }

    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  return null;
}
