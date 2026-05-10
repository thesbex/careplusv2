import { createContext, useContext } from 'react';

export interface SpotlightContextValue {
  openSpotlight: () => void;
}

export const SpotlightContext = createContext<SpotlightContextValue | null>(null);

/**
 * Returns the spotlight opener provided by <AppLayout>. Falls back to a no-op
 * when used outside the layout (e.g. unit tests of <Screen /> rendered without
 * the layout wrapper) so the search icon click silently does nothing instead
 * of throwing.
 */
export function useSpotlight(): SpotlightContextValue {
  return useContext(SpotlightContext) ?? { openSpotlight: () => {} };
}
