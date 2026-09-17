'use client';

import { useEffect } from 'react';

interface SplashScreenPlugin {
  hide(options?: { fadeOutDuration?: number }): Promise<void>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { SplashScreen?: SplashScreenPlugin };
}

/** Hides the native iOS splash as soon as the web app has painted, handing off to the web splash without a blank frame. */
export default function NativeSplash() {
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    capacitor.Plugins?.SplashScreen?.hide({ fadeOutDuration: 250 }).catch(() => {});
  }, []);
  return null;
}
