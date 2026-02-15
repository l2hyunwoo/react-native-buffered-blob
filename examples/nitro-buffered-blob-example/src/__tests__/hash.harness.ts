import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import { NitroModules } from 'react-native-nitro-modules';
import type { BufferedBlobModule } from 'react-native-nitro-buffered-blob';
import { HashAlgorithm } from 'react-native-nitro-buffered-blob';

const encoder = new TextEncoder();

const module =
  NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');

async function writeTestFile(path: string, content: string): Promise<void> {
  const data = encoder.encode(content);
  const writer = module.openWrite(path, false);
  await writer.write(data.buffer as ArrayBuffer);
  await writer.flush();
  writer.close();
}

describe('Native Hashing', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `${module.tempDir}/harness-hash-${Date.now()}`;
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

  test('hashFile with SHA256 returns a hex string', async () => {
    const filePath = `${testDir}/sha256-test.txt`;
    await writeTestFile(filePath, 'hash me sha256');

    const hash = await module.hashFile(filePath, HashAlgorithm.SHA256);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(64); // SHA256 hex is 64 chars
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  test('hashFile with MD5 returns a hex string', async () => {
    const filePath = `${testDir}/md5-test.txt`;
    await writeTestFile(filePath, 'hash me md5');

    const hash = await module.hashFile(filePath, HashAlgorithm.MD5);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBe(32); // MD5 hex is 32 chars
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  test('consistent hash for same content (SHA256)', async () => {
    const filePath1 = `${testDir}/consistent1.txt`;
    const filePath2 = `${testDir}/consistent2.txt`;
    const content = 'identical content for hashing';
    await writeTestFile(filePath1, content);
    await writeTestFile(filePath2, content);

    const hash1 = await module.hashFile(filePath1, HashAlgorithm.SHA256);
    const hash2 = await module.hashFile(filePath2, HashAlgorithm.SHA256);
    expect(hash1).toBe(hash2);
  });

  test('consistent hash for same content (MD5)', async () => {
    const filePath1 = `${testDir}/consistent-md5-1.txt`;
    const filePath2 = `${testDir}/consistent-md5-2.txt`;
    const content = 'identical content for md5 hashing';
    await writeTestFile(filePath1, content);
    await writeTestFile(filePath2, content);

    const hash1 = await module.hashFile(filePath1, HashAlgorithm.MD5);
    const hash2 = await module.hashFile(filePath2, HashAlgorithm.MD5);
    expect(hash1).toBe(hash2);
  });

  test('different content produces different hashes', async () => {
    const filePath1 = `${testDir}/diff1.txt`;
    const filePath2 = `${testDir}/diff2.txt`;
    await writeTestFile(filePath1, 'content A');
    await writeTestFile(filePath2, 'content B');

    const hash1 = await module.hashFile(filePath1, HashAlgorithm.SHA256);
    const hash2 = await module.hashFile(filePath2, HashAlgorithm.SHA256);
    expect(hash1).not.toBe(hash2);
  });
});
