/* global jest */
// Setup file for jest
// Mock react-native TurboModuleRegistry if needed
jest.mock('react-native', () => ({
  TurboModuleRegistry: {
    getEnforcing: jest.fn((name) => {
      // Return the mocked module
      return require('./__mocks__/NativeBufferedBlob').default;
    }),
  },
}));
