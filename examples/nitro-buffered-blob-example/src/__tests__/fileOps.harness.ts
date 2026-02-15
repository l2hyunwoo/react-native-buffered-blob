import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import { NitroModules } from 'react-native-nitro-modules';
import type { BufferedBlobModule } from 'react-native-nitro-buffered-blob';
import { FileType } from 'react-native-nitro-buffered-blob';

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

describe('File Operations', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `${module.tempDir}/harness-fileops-${Date.now()}`;
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

  test('exists returns false for non-existent file', async () => {
    const result = await module.exists(`${testDir}/does-not-exist.txt`);
    expect(result).toBe(false);
  });

  test('mkdir creates directory', async () => {
    const subDir = `${testDir}/sub`;
    await module.mkdir(subDir);
    const result = await module.exists(subDir);
    expect(result).toBe(true);
  });

  test('stat returns FileInfo with correct fields', async () => {
    const filePath = `${testDir}/stat-test.txt`;
    const content = 'stat test content';
    await writeTestFile(filePath, content);

    const info = await module.stat(filePath);
    const expectedSize = encoder.encode(content).byteLength;

    expect(info.name).toBe('stat-test.txt');
    expect(info.size).toBe(expectedSize);
    expect(info.type).toBe(FileType.FILE);
    expect(info.lastModified).toBeGreaterThan(0);
    expect(typeof info.path).toBe('string');
  });

  test('stat returns DIRECTORY type for directories', async () => {
    const info = await module.stat(testDir);
    expect(info.type).toBe(FileType.DIRECTORY);
  });

  test('ls lists directory contents', async () => {
    await writeTestFile(`${testDir}/file1.txt`, 'a');
    await writeTestFile(`${testDir}/file2.txt`, 'b');

    const entries = await module.ls(testDir);
    const names = entries.map((e) => e.name).sort();

    expect(names.length).toBe(2);
    expect(names[0]).toBe('file1.txt');
    expect(names[1]).toBe('file2.txt');
  });

  test('cp copies file and both exist', async () => {
    const srcPath = `${testDir}/src.txt`;
    const dstPath = `${testDir}/dst.txt`;
    const content = 'copy test content';
    await writeTestFile(srcPath, content);

    await module.cp(srcPath, dstPath);

    const srcExists = await module.exists(srcPath);
    const dstExists = await module.exists(dstPath);
    expect(srcExists).toBe(true);
    expect(dstExists).toBe(true);
  });

  test('mv moves file (source gone, dest exists)', async () => {
    const srcPath = `${testDir}/mv-src.txt`;
    const dstPath = `${testDir}/mv-dst.txt`;
    const content = 'move test content';
    await writeTestFile(srcPath, content);

    await module.mv(srcPath, dstPath);

    const srcExists = await module.exists(srcPath);
    const dstExists = await module.exists(dstPath);
    expect(srcExists).toBe(false);
    expect(dstExists).toBe(true);
  });

  test('unlink deletes file', async () => {
    const filePath = `${testDir}/to-delete.txt`;
    await writeTestFile(filePath, 'delete me');
    expect(await module.exists(filePath)).toBe(true);

    await module.unlink(filePath);
    expect(await module.exists(filePath)).toBe(false);
  });
});
