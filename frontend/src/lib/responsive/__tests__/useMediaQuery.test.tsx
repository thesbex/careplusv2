import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile, useMediaQuery } from '../useMediaQuery';

type Listener = (e: { matches: boolean }) => void;

function mockMatchMedia(initial: boolean) {
  const listeners: Listener[] = [];
  let matches = initial;
  const mql = {
    get matches() {
      return matches;
    },
    media: '(max-width: 640px)',
    addEventListener: (_: string, cb: Listener) => {
      listeners.push(cb);
    },
    removeEventListener: (_: string, cb: Listener) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    dispatch: (next: boolean) => {
      matches = next;
      listeners.forEach((l) => l({ matches: next }));
    },
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  return mql;
}

describe('useMediaQuery / useIsMobile', () => {
  const original = window.matchMedia;
  beforeEach(() => {
    // reset between tests
  });
  afterEach(() => {
    window.matchMedia = original;
  });

  it('returns the initial match state', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
    act(() => mql.dispatch(true));
    expect(result.current).toBe(true);
    act(() => mql.dispatch(false));
    expect(result.current).toBe(false);
  });

  it('useMediaQuery accepts arbitrary queries', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });
});
