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
const decoder = new TextDecoder();

const module =
  NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');

describe('NativeFileWriter', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `${module.tempDir}/harness-writer-${Date.now()}`;
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

  test('openWrite returns a NativeFileWriter HybridObject', () => {
    const filePath = `${testDir}/writer-test.txt`;
    const writer = module.openWrite(filePath, false);
    expect(writer).toBeDefined();
    expect(typeof writer.write).toBe('function');
    expect(typeof writer.flush).toBe('function');
    expect(typeof writer.close).toBe('function');
    writer.close();
  });

  test('write accepts ArrayBuffer and returns bytes written', async () => {
    const filePath = `${testDir}/write-test.txt`;
    const data = encoder.encode('hello writer');
    const writer = module.openWrite(filePath, false);

    const bytesWritten = await writer.write(data.buffer as ArrayBuffer);
    expect(bytesWritten).toBe(data.byteLength);
    writer.close();
  });

  test('bytesWritten reflects total written', async () => {
    const filePath = `${testDir}/total-written.txt`;
    const writer = module.openWrite(filePath, false);

    const data1 = encoder.encode('first ');
    const data2 = encoder.encode('second');
    await writer.write(data1.buffer as ArrayBuffer);
    await writer.write(data2.buffer as ArrayBuffer);

    expect(writer.bytesWritten).toBe(data1.byteLength + data2.byteLength);
    writer.close();
  });

  test('flush completes without error', async () => {
    const filePath = `${testDir}/flush-test.txt`;
    const writer = module.openWrite(filePath, false);
    const data = encoder.encode('flush data');
    await writer.write(data.buffer as ArrayBuffer);

    await writer.flush();
    // No exception means success
    expect(true).toBe(true);
    writer.close();
  });

  test('close works without error', () => {
    const filePath = `${testDir}/close-test.txt`;
    const writer = module.openWrite(filePath, false);
    writer.close();
    expect(true).toBe(true);
  });

  test('write then read roundtrip', async () => {
    const filePath = `${testDir}/roundtrip.txt`;
    const content = 'roundtrip test content 123!';
    const data = encoder.encode(content);

    // Write
    const writer = module.openWrite(filePath, false);
    await writer.write(data.buffer as ArrayBuffer);
    await writer.flush();
    writer.close();

    // Read back
    const reader = module.openRead(filePath, 4096);
    const chunks: ArrayBuffer[] = [];
    while (!reader.isEOF) {
      const chunk = await reader.readNextChunk();
      if (chunk) chunks.push(chunk);
    }
    reader.close();

    const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    const readBack = decoder.decode(merged);

    expect(readBack).toBe(content);
  });
});
