import type { FlowScreenDef } from '../lib/onboarding-flow.generated';

export interface CollectedScreens {
  screens: FlowScreenDef[];
  /** Athlete app checkouts that were read. Empty when none is present. */
  sources: string[];
}

export function collectScreens(): CollectedScreens;
export function render(collected: CollectedScreens): string;
