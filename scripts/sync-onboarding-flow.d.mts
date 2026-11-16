import type { FlowScreenDef } from '../lib/onboarding-flow.generated';

export interface CollectedScreens {
  /** The classic flow. */
  screens: FlowScreenDef[];
  /** The short flow; empty when the web app does not have one. */
  short: FlowScreenDef[];
  /** Athlete app checkouts that were read. Empty when none is present. */
  sources: string[];
}

export function collectScreens(): CollectedScreens;
export function render(collected: CollectedScreens): string;
