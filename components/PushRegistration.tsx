'use client';

import { useEffect } from 'react';

interface RegistrationToken {
  value: string;
}

interface PermissionStatus {
  receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}

interface PushNotificationsPlugin {
  requestPermissions(): Promise<PermissionStatus>;
  register(): Promise<void>;
  addListener(
    eventName: 'registration',
    listener: (token: RegistrationToken) => void,
  ): Promise<unknown>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { PushNotifications?: PushNotificationsPlugin };
}

/**
 * When the dashboard runs inside the Capacitor iOS shell, asks for push
 * permission and registers the device token with the server.
 * Renders nothing and does nothing in a normal browser.
 */
export default function PushRegistration() {
  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    const push = capacitor.Plugins?.PushNotifications;
    if (!push) return;

    let cancelled = false;

    void (async () => {
      const status = await push.requestPermissions();
      if (cancelled || status.receive !== 'granted') return;

      await push.addListener('registration', token => {
        void fetch('/api/devices', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: token.value, platform: 'ios' }),
        });
      });
      await push.register();
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
