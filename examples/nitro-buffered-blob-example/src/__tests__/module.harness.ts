import { describe, test, expect } from 'react-native-harness';
import { NitroModules } from 'react-native-nitro-modules';
import type { BufferedBlobModule } from 'react-native-nitro-buffered-blob';

describe('BufferedBlobModule - Module Instantiation & Directory Paths', () => {
  test('createHybridObject succeeds', () => {
    const module =
      NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');
    expect(module).toBeDefined();
  });

  test('documentDir is a non-empty string', () => {
    const module =
      NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');
    expect(typeof module.documentDir).toBe('string');
    expect(module.documentDir.length).toBeGreaterThan(0);
  });

  test('cacheDir is a non-empty string', () => {
    const module =
      NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');
    expect(typeof module.cacheDir).toBe('string');
    expect(module.cacheDir.length).toBeGreaterThan(0);
  });

  test('tempDir is a non-empty string', () => {
    const module =
      NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');
    expect(typeof module.tempDir).toBe('string');
    expect(module.tempDir.length).toBeGreaterThan(0);
  });

  test('downloadDir is a non-empty string', () => {
    const module =
      NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');
    expect(typeof module.downloadDir).toBe('string');
    expect(module.downloadDir.length).toBeGreaterThan(0);
  });
});
