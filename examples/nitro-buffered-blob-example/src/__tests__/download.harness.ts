import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import { NitroModules } from 'react-native-nitro-modules';
import type {
  BufferedBlobModule,
  DownloadProgress,
} from 'react-native-nitro-buffered-blob';

const module =
  NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');

// Small public test file for download tests
const TEST_URL = 'https://httpbin.org/bytes/1024';
const TEST_TEXT_URL = 'https://httpbin.org/robots.txt';

describe('Download', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `${module.tempDir}/harness-download-${Date.now()}`;
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

  test('download creates file at destination', async () => {
    const destPath = `${testDir}/downloaded.bin`;

    const downloader = module.createDownload(TEST_URL, destPath, {});
    await downloader.start(() => {});

    const fileExists = await module.exists(destPath);
    expect(fileExists).toBe(true);
  });

  test('downloaded file has correct size', async () => {
    const destPath = `${testDir}/sized.bin`;

    const downloader = module.createDownload(TEST_URL, destPath, {});
    await downloader.start(() => {});

    const info = await module.stat(destPath);
    expect(info.size).toBe(1024);
  });

  test('download with progress callback receives progress events', async () => {
    const destPath = `${testDir}/progress.txt`;
    const progressEvents: DownloadProgress[] = [];

    const downloader = module.createDownload(TEST_TEXT_URL, destPath, {});
    await downloader.start((progress: DownloadProgress) => {
      progressEvents.push({ ...progress });
    });

    const fileExists = await module.exists(destPath);
    expect(fileExists).toBe(true);

    // Should have received at least one progress event
    expect(progressEvents.length).toBeGreaterThan(0);

    // Last event should have bytesDownloaded > 0
    const lastEvent = progressEvents[progressEvents.length - 1];
    if (lastEvent) {
      expect(lastEvent.bytesDownloaded).toBeGreaterThan(0);
    }
  });

  test('download with custom headers', async () => {
    const destPath = `${testDir}/headers.bin`;

    const downloader = module.createDownload(TEST_URL, destPath, {
      Accept: 'application/octet-stream',
    });
    await downloader.start(() => {});

    const fileExists = await module.exists(destPath);
    expect(fileExists).toBe(true);
  });
});
