'use client';
import { createContext, useContext } from 'react';
import type { Screen } from '@/components/motion';
import { ProfileScreen } from '@/components/profile/ProfileScreen';
import type { UserRecord } from '@/lib/types';

export interface NavContextValue {
  push: (screen: Screen) => void;
  pop: () => void;
  /** Every account, so screens can link parents to their athlete and back */
  users: UserRecord[];
}

export interface Nav extends NavContextValue {
  /** Pushes the person's profile (athlete or parent layout) */
  open: (user: UserRecord) => void;
}

export const NavContext = createContext<NavContextValue>({ push: () => {}, pop: () => {}, users: [] });

export function useNav(): Nav {
  const ctx = useContext(NavContext);
  const open = (user: UserRecord) => ctx.push({ key: 'profile-' + user.id, node: <ProfileScreen user={user} /> });
  return { ...ctx, open };
}
