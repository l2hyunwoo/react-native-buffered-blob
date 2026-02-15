import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import { NitroModules } from 'react-native-nitro-modules';
import type { BufferedBlobModule } from 'react-native-nitro-buffered-blob';

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

describe('NativeFileReader', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `${module.tempDir}/harness-reader-${Date.now()}`;
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

  test('openRead returns a NativeFileReader HybridObject', async () => {
    const filePath = `${testDir}/reader-test.txt`;
    await writeTestFile(filePath, 'hello');

    const reader = module.openRead(filePath, 4096);
    expect(reader).toBeDefined();
    expect(typeof reader.readNextChunk).toBe('function');
    expect(typeof reader.close).toBe('function');
    reader.close();
  });

  test('fileSize returns correct size', async () => {
    const filePath = `${testDir}/size-test.txt`;
    const content = 'hello world';
    const expectedSize = encoder.encode(content).byteLength;
    await writeTestFile(filePath, content);

    const reader = module.openRead(filePath, 4096);
    expect(reader.fileSize).toBe(expectedSize);
    reader.close();
  });

  test('readNextChunk returns ArrayBuffer', async () => {
    const filePath = `${testDir}/chunk-test.txt`;
    await writeTestFile(filePath, 'chunk data');

    const reader = module.openRead(filePath, 4096);
    const chunk = await reader.readNextChunk();
    expect(chunk).toBeDefined();
    expect(chunk instanceof ArrayBuffer).toBe(true);
    expect(chunk!.byteLength).toBeGreaterThan(0);
    reader.close();
  });

  test('reader reaches EOF (isEOF becomes true)', async () => {
    const filePath = `${testDir}/eof-test.txt`;
    await writeTestFile(filePath, 'small content');

    const reader = module.openRead(filePath, 4096);
    expect(reader.isEOF).toBe(false);

    // Read all chunks until EOF
    while (!reader.isEOF) {
      await reader.readNextChunk();
    }

    expect(reader.isEOF).toBe(true);
    reader.close();
  });

  test('bytesRead reflects total bytes read', async () => {
    const filePath = `${testDir}/bytes-read-test.txt`;
    const content = 'bytes read tracking';
    const expectedSize = encoder.encode(content).byteLength;
    await writeTestFile(filePath, content);

    const reader = module.openRead(filePath, 4096);
    expect(reader.bytesRead).toBe(0);

    while (!reader.isEOF) {
      await reader.readNextChunk();
    }

    expect(reader.bytesRead).toBe(expectedSize);
    reader.close();
  });

  test('close works without error', async () => {
    const filePath = `${testDir}/close-test.txt`;
    await writeTestFile(filePath, 'close test');

    const reader = module.openRead(filePath, 4096);
    reader.close();
    // No exception means success
    expect(true).toBe(true);
  });
});
