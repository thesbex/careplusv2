import { useEffect, useState } from 'react';

/**
 * Subscribes to a CSS media query and returns whether it matches.
 * SSR-safe: returns `false` on the server and hydrates on mount.
 *
 * Per DESIGN_SYSTEM.md §5, careplus uses a single breakpoint at 640px to
 * switch between desktop (<Screen>) and mobile (<MScreen>) layouts.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Initial sync in case the query resolved differently post-hydration
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Convenience — the careplus mobile breakpoint (`<= 640px`). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 640px)');
}
