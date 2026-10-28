// Global test setup. Network access is always mocked per test; nothing here talks to a real server.
beforeEach(() => {
  jest.useRealTimers();
});

// SafeAreaView needs native insets; a plain View keeps layout tests deterministic.
jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  const rn = jest.requireActual('react-native');
  return { ...actual, SafeAreaView: rn.View };
});

// Motion is exercised separately; tests run with the static (reduced-motion) presentation.
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
