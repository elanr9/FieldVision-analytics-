'use client';

import { useEffect, useState } from 'react';

interface RegistrationToken {
  value: string;
}

interface PermissionStatus {
  receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied';
}

interface PushNotification {
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

interface ActionPerformed {
  notification: PushNotification;
}

interface PushNotificationsPlugin {
  requestPermissions(): Promise<PermissionStatus>;
  register(): Promise<void>;
  addListener(
    eventName: 'registration',
    listener: (token: RegistrationToken) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'pushNotificationReceived',
    listener: (notification: PushNotification) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: 'pushNotificationActionPerformed',
    listener: (action: ActionPerformed) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: { PushNotifications?: PushNotificationsPlugin };
}

export const OPEN_USER_EVENT = 'fv:open-user';

export function openUserFromPush(userId: string) {
  window.dispatchEvent(new CustomEvent(OPEN_USER_EVENT, { detail: { userId } }));
}

interface Banner {
  title: string;
  body: string;
  userId?: string;
}

/**
 * When the dashboard runs inside the Capacitor iOS shell, asks for push
 * permission, registers the device token, and surfaces taps / foreground
 * alerts into the dashboard (open user profile + in-app banner).
 */
export default function PushRegistration() {
  const [banner, setBanner] = useState<Banner | null>(null);

  useEffect(() => {
    const capacitor = (window as Window & { Capacitor?: CapacitorGlobal }).Capacitor;
    if (!capacitor?.isNativePlatform?.()) return;
    const push = capacitor.Plugins?.PushNotifications;
    if (!push) return;

    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    const showBanner = (notification: PushNotification) => {
      const title = notification.title ?? 'FieldVision';
      const body = notification.body ?? '';
      const userId = notification.data?.userId;
      setBanner({ title, body, userId });
      window.setTimeout(() => {
        setBanner(current => (current?.title === title && current.body === body ? null : current));
      }, 6000);
    };

    const handleOpen = (notification: PushNotification) => {
      const userId = notification.data?.userId;
      if (userId) openUserFromPush(userId);
    };

    void (async () => {
      const status = await push.requestPermissions();
      if (cancelled || status.receive !== 'granted') return;

      handles.push(
        await push.addListener('registration', token => {
          void fetch('/api/devices', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ token: token.value, platform: 'ios' }),
          });
        }),
      );
      handles.push(
        await push.addListener('pushNotificationReceived', notification => {
          showBanner(notification);
        }),
      );
      handles.push(
        await push.addListener('pushNotificationActionPerformed', action => {
          handleOpen(action.notification);
        }),
      );
      await push.register();
    })();

    return () => {
      cancelled = true;
      for (const handle of handles) {
        void handle.remove();
      }
    };
  }, []);

  if (!banner) return null;

  return (
    <button
      type="button"
      onClick={() => {
        if (banner.userId) openUserFromPush(banner.userId);
        setBanner(null);
      }}
      className="fixed inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[100] rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-lg active:scale-[0.99]"
    >
      <p className="text-sm font-bold text-neutral-900">{banner.title}</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-600">{banner.body}</p>
    </button>
  );
}
