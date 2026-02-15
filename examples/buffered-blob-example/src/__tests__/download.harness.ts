import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import {
  download,
  exists,
  stat,
  mkdir,
  unlink,
  ls,
  Dirs,
  join,
} from 'react-native-buffered-blob';
import type { DownloadProgress } from 'react-native-buffered-blob';

// Small public test file for download tests
const TEST_URL = 'https://httpbin.org/bytes/1024';
const TEST_TEXT_URL = 'https://httpbin.org/robots.txt';

describe('Download', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(Dirs.temp, `harness-download-${Date.now()}`);
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

  test('download creates file at destination', async () => {
    const destPath = join(testDir, 'downloaded.bin');

    const handle = download({ url: TEST_URL, destPath });
    await handle.promise;

    const fileExists = await exists(destPath);
    expect(fileExists).toBe(true);
  });

  test('downloaded file has correct size', async () => {
    const destPath = join(testDir, 'sized.bin');

    const handle = download({ url: TEST_URL, destPath });
    await handle.promise;

    const info = await stat(destPath);
    expect(info.size).toBe(1024);
  });

  test('download with progress callback receives progress events', async () => {
    const destPath = join(testDir, 'progress.txt');
    const progressEvents: DownloadProgress[] = [];

    const handle = download({
      url: TEST_TEXT_URL,
      destPath,
      onProgress: (progress) => {
        progressEvents.push({ ...progress });
      },
    });
    await handle.promise;

    const fileExists = await exists(destPath);
    expect(fileExists).toBe(true);

    // Should have received at least one progress event
    expect(progressEvents.length).toBeGreaterThan(0);

    // Last event should have progress close to or equal to 1
    const lastEvent = progressEvents[progressEvents.length - 1];
    if (lastEvent) {
      expect(lastEvent.bytesDownloaded).toBeGreaterThan(0);
    }
  });

  test('download with custom headers', async () => {
    const destPath = join(testDir, 'headers.bin');

    const handle = download({
      url: TEST_URL,
      destPath,
      headers: { Accept: 'application/octet-stream' },
    });
    await handle.promise;

    const fileExists = await exists(destPath);
    expect(fileExists).toBe(true);
  });
});
