/**
 * A stand-in for `IntersectionObserver`, which jsdom does not have. The `Select` of @grafana/ui uses it when its
 * menu opens. Grafana core adds the same stand-in in its jest setup. Call it in `beforeAll` of a test file.
 */
export function stubIntersectionObserver() {
  if (typeof window.IntersectionObserver === 'undefined') {
    window.IntersectionObserver = class {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    };
  }
}
