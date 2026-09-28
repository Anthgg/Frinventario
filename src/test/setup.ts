import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetConnection } from '@/api/connection';
import { setAccessToken, setApiAuthHandler } from '@/api/client';
import { resetQueryCache } from '@/api/query';
import { resetRefreshController } from '@/auth/refreshController';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.sessionStorage.clear();
  setApiAuthHandler(null);
  setAccessToken(null);
  resetConnection();
  resetQueryCache();
  resetRefreshController();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

/* jsdom no implementa matchMedia: Radix y la UI de reduced-motion lo usan. */
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/* Radix mide elementos con ResizeObserver. */
if (typeof globalThis.ResizeObserver !== 'function') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
