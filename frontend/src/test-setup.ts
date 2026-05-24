import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, expect, vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

// jsdom lacks the canvas/2D globals pdfjs-dist references at import time
// (DOMMatrix, Path2D). Any test that transitively imports a PDF component (or
// the full router) would otherwise throw "DOMMatrix is not defined" before a
// single assertion runs. Minimal stubs — these are never exercised in jsdom.
if (typeof globalThis.DOMMatrix === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMMatrix = class DOMMatrix {};
}
if (typeof globalThis.Path2D === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Path2D = class Path2D {};
}

// jsdom doesn't implement matchMedia — polyfill it so hooks like useIsMobile
// work in tests. Defaults to `matches: false` so tests render the desktop
// layout; individual tests can override window.matchMedia to simulate mobile.
beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }

  // Silence React Router v7 future-flag warnings in test output. Production
  // router opts into the same flags — tests don't need to re-emit the same
  // reminder on every render.
  const originalWarn = console.warn;
  vi.spyOn(console, 'warn').mockImplementation((msg: unknown, ...rest: unknown[]) => {
    if (typeof msg === 'string' && msg.includes('React Router Future Flag Warning')) return;
    originalWarn(msg, ...rest);
  });
});

afterEach(() => {
  cleanup();
});
