'use client';
import { createContext, useContext } from 'react';
import type { Screen } from '@/components/motion';

export interface NavContextValue {
  push: (screen: Screen) => void;
  pop: () => void;
}

export const NavContext = createContext<NavContextValue>({ push: () => {}, pop: () => {} });

export function useNav(): NavContextValue {
  return useContext(NavContext);
}
