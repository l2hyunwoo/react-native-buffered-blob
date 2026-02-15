import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import { NitroModules } from 'react-native-nitro-modules';
import type { BufferedBlobModule } from 'react-native-nitro-buffered-blob';

const module =
  NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');

describe('Error Handling', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `${module.tempDir}/harness-error-${Date.now()}`;
    await module.mkdir(testDir);
  });

  afterEach(async () => {
    try {
      const entries = await module.ls(testDir);
      for (const entry of entries) {
        await module.unlink(`${testDir}/${entry.name}`);
      }
      await module.unlink(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('stat throws for non-existent file', async () => {
    const fakePath = `${testDir}/does-not-exist.txt`;
    try {
      await module.stat(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect(typeof (e as Error).message).toBe('string');
      expect((e as Error).message.length).toBeGreaterThan(0);
    }
  });

  test('unlink throws for non-existent file', async () => {
    const fakePath = `${testDir}/no-file.txt`;
    try {
      await module.unlink(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect(typeof (e as Error).message).toBe('string');
      expect((e as Error).message.length).toBeGreaterThan(0);
    }
  });

  test('ls throws for non-existent directory', async () => {
    const fakePath = `${testDir}/no-dir`;
    try {
      await module.ls(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect(typeof (e as Error).message).toBe('string');
      expect((e as Error).message.length).toBeGreaterThan(0);
    }
  });

  test('Error has message string', async () => {
    const fakePath = `${testDir}/error-msg-test.txt`;
    try {
      await module.stat(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof Error).toBe(true);
      expect(typeof (e as Error).message).toBe('string');
      expect((e as Error).message.length).toBeGreaterThan(0);
    }
  });
});
