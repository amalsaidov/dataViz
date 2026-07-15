import { vi } from 'vitest';

vi.stubGlobal(
  // biome-ignore lint/nursery/noSecrets: IntersectionObserver is a standard browser API name
  'IntersectionObserver',
  class {
    observe() {
      /* empty */
    }
    unobserve() {
      /* empty */
    }
    disconnect() {
      /* empty */
    }
  }
);

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {
    /* empty */
  },
  removeListener: () => {
    /* empty */
  },
  addEventListener: () => {
    /* empty */
  },
  removeEventListener: () => {
    /* empty */
  },
  dispatchEvent: () => false,
}));
