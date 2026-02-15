import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import {
  createWriter,
  createReader,
  mkdir,
  unlink,
  ls,
  Dirs,
  join,
  BlobError,
  ErrorCode,
} from 'react-native-buffered-blob';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function mergeChunks(chunks: ArrayBuffer[]): string {
  const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  }
  return decoder.decode(merged);
}

describe('Streaming I/O', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(Dirs.temp, `harness-streaming-${Date.now()}`);
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

  test('write data then read it back', async () => {
    const filePath = join(testDir, 'write-read.txt');
    const content = 'Hello from streaming test!';
    const data = encoder.encode(content);

    const writer = createWriter(filePath);
    await writer.write(data.buffer as ArrayBuffer);
    await writer.flush();
    writer.close();

    const reader = createReader(filePath);
    const chunks: ArrayBuffer[] = [];
    while (!reader.isEOF) {
      const chunk = await reader.readNextChunk();
      if (chunk) chunks.push(chunk);
    }
    reader.close();

    const result = mergeChunks(chunks);
    expect(result).toBe(content);
  });

  test('written bytes match read bytes', async () => {
    const filePath = join(testDir, 'bytes-match.txt');
    const chunks = ['chunk1', 'chunk2', 'chunk3'];
    let expectedBytes = 0;

    const writer = createWriter(filePath);
    for (const chunk of chunks) {
      const data = encoder.encode(chunk);
      await writer.write(data.buffer as ArrayBuffer);
      expectedBytes += data.byteLength;
    }
    await writer.flush();
    writer.close();

    expect(writer.bytesWritten).toBe(expectedBytes);

    const reader = createReader(filePath);
    while (!reader.isEOF) {
      await reader.readNextChunk();
    }
    expect(reader.bytesRead).toBe(reader.fileSize);
    expect(reader.fileSize).toBe(expectedBytes);
    reader.close();
  });

  test('reader reaches EOF after reading all data', async () => {
    const filePath = join(testDir, 'eof-test.txt');
    const data = encoder.encode('Small content');

    const writer = createWriter(filePath);
    await writer.write(data.buffer as ArrayBuffer);
    await writer.flush();
    writer.close();

    const reader = createReader(filePath);
    expect(reader.isEOF).toBe(false);

    while (!reader.isEOF) {
      await reader.readNextChunk();
    }

    expect(reader.isEOF).toBe(true);
    reader.close();
  });

  test('writer with append mode adds to existing file', async () => {
    const filePath = join(testDir, 'append.txt');

    // Write initial content
    const writer1 = createWriter(filePath, false);
    await writer1.write(encoder.encode('first').buffer as ArrayBuffer);
    await writer1.flush();
    writer1.close();

    // Append more content
    const writer2 = createWriter(filePath, true);
    await writer2.write(encoder.encode('second').buffer as ArrayBuffer);
    await writer2.flush();
    writer2.close();

    // Read back
    const reader = createReader(filePath);
    const chunks: ArrayBuffer[] = [];
    while (!reader.isEOF) {
      const chunk = await reader.readNextChunk();
      if (chunk) chunks.push(chunk);
    }
    reader.close();

    const result = mergeChunks(chunks);
    expect(result).toBe('firstsecond');
  });

  test('reader.close() prevents further reads', async () => {
    const filePath = join(testDir, 'close-reader.txt');
    const data = encoder.encode('test content for close');

    const writer = createWriter(filePath);
    await writer.write(data.buffer as ArrayBuffer);
    await writer.flush();
    writer.close();

    const reader = createReader(filePath);
    reader.close();

    try {
      await reader.readNextChunk();
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
      expect((e as BlobError).code).toBe(ErrorCode.READER_CLOSED);
    }
  });

  test('writer.close() prevents further writes', async () => {
    const filePath = join(testDir, 'close-writer.txt');

    const writer = createWriter(filePath);
    writer.close();

    try {
      const data = encoder.encode('should fail');
      await writer.write(data.buffer as ArrayBuffer);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
      expect((e as BlobError).code).toBe(ErrorCode.WRITER_CLOSED);
    }
  });
});
