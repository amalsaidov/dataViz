// An iframe with `sandbox="allow-scripts"` and no `allow-same-origin` throws a `SecurityError` on each
// `localStorage` access (viz contract, section 6).
// https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage#exceptions
describe('development in a sandboxed iframe', () => {
  const ci = process.env.CI;

  beforeEach(() => {
    // With CI set, the module does not read `localStorage`, so the test would not check the read.
    delete process.env.CI;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw new DOMException('The document is sandboxed and lacks the "allow-same-origin" flag.', 'SecurityError');
      },
    });
  });

  afterEach(() => {
    process.env.CI = ci;
    // Removes the own property, so `localStorage` is the jsdom one again.
    delete (window as { localStorage?: Storage }).localStorage;
    jest.restoreAllMocks();
  });

  it('loads and logs when localStorage throws', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    jest.isolateModules(() => {
      const { debug, LOG_LEVELS } = require('./development');
      expect(() => debug('message', LOG_LEVELS.error)).not.toThrow();
    });
    expect(consoleError).toHaveBeenCalledWith('message', undefined);
  });
});
