import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import {
  stat,
  unlink,
  ls,
  mkdir,
  Dirs,
  join,
  BlobError,
  ErrorCode,
} from 'react-native-buffered-blob';

describe('Error Handling', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(Dirs.temp, `harness-error-${Date.now()}`);
    await mkdir(testDir);
  });

  afterEach(async () => {
    try {
      const entries = await ls(testDir);
      for (const entry of entries) {
        await unlink(join(testDir, entry.name));
      }
      await unlink(testDir);
    } catch {
      // Ignore cleanup errors
    }
  });

  test('stat throws BlobError for non-existent file', async () => {
    const fakePath = join(testDir, 'does-not-exist.txt');
    try {
      await stat(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
      expect((e as BlobError).code).toBe(ErrorCode.FILE_NOT_FOUND);
    }
  });

  test('unlink throws BlobError for non-existent file', async () => {
    const fakePath = join(testDir, 'no-file.txt');
    try {
      await unlink(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
      expect((e as BlobError).code).toBe(ErrorCode.FILE_NOT_FOUND);
    }
  });

  test('ls throws BlobError for non-existent directory', async () => {
    const fakePath = join(testDir, 'no-dir');
    try {
      await ls(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
    }
  });

  test('BlobError has correct path property', async () => {
    const fakePath = join(testDir, 'error-path-test.txt');
    try {
      await stat(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
      expect((e as BlobError).path).toBe(fakePath);
    }
  });

  test('BlobError has message string', async () => {
    const fakePath = join(testDir, 'error-msg-test.txt');
    try {
      await stat(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
      expect(typeof (e as BlobError).message).toBe('string');
      expect((e as BlobError).message.length).toBeGreaterThan(0);
    }
  });
});
