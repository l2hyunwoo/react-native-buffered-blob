import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import {
  exists,
  mkdir,
  stat,
  ls,
  cp,
  mv,
  unlink,
  createWriter,
  createReader,
  Dirs,
  join,
  FileType,
  BlobError,
} from 'react-native-buffered-blob';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function writeText(path: string, content: string): Promise<void> {
  const data = encoder.encode(content);
  const writer = createWriter(path);
  await writer.write(data.buffer as ArrayBuffer);
  await writer.flush();
  writer.close();
}

async function readText(path: string): Promise<string> {
  const reader = createReader(path);
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
  return decoder.decode(merged);
}

describe('File Operations', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(Dirs.temp, `harness-fileops-${Date.now()}`);
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

  test('exists returns false for non-existent file', async () => {
    const result = await exists(join(testDir, 'does-not-exist.txt'));
    expect(result).toBe(false);
  });

  test('mkdir creates directory and exists returns true', async () => {
    const subDir = join(testDir, 'sub');
    await mkdir(subDir);
    const result = await exists(subDir);
    expect(result).toBe(true);
  });

  test('stat returns correct FileInfo for a created file', async () => {
    const filePath = join(testDir, 'stat-test.txt');
    const content = 'stat test content';
    await writeText(filePath, content);

    const info = await stat(filePath);
    const expectedSize = encoder.encode(content).byteLength;

    expect(info.name).toBe('stat-test.txt');
    expect(info.size).toBe(expectedSize);
    expect(info.type).toBe(FileType.FILE);
    expect(info.lastModified).toBeGreaterThan(0);
  });

  test('stat returns DIRECTORY type for directories', async () => {
    const info = await stat(testDir);
    expect(info.type).toBe(FileType.DIRECTORY);
  });

  test('ls lists directory contents', async () => {
    await writeText(join(testDir, 'file1.txt'), 'a');
    await writeText(join(testDir, 'file2.txt'), 'b');

    const entries = await ls(testDir);
    const names = entries.map((e) => e.name).sort();

    expect(names.length).toBe(2);
    expect(names[0]).toBe('file1.txt');
    expect(names[1]).toBe('file2.txt');
  });

  test('cp copies file and both exist', async () => {
    const srcPath = join(testDir, 'src.txt');
    const dstPath = join(testDir, 'dst.txt');
    const content = 'copy test content';
    await writeText(srcPath, content);

    await cp(srcPath, dstPath);

    const srcExists = await exists(srcPath);
    const dstExists = await exists(dstPath);
    expect(srcExists).toBe(true);
    expect(dstExists).toBe(true);

    const copiedContent = await readText(dstPath);
    expect(copiedContent).toBe(content);
  });

  test('mv moves file (source gone, dest exists)', async () => {
    const srcPath = join(testDir, 'mv-src.txt');
    const dstPath = join(testDir, 'mv-dst.txt');
    const content = 'move test content';
    await writeText(srcPath, content);

    await mv(srcPath, dstPath);

    const srcExists = await exists(srcPath);
    const dstExists = await exists(dstPath);
    expect(srcExists).toBe(false);
    expect(dstExists).toBe(true);

    const movedContent = await readText(dstPath);
    expect(movedContent).toBe(content);
  });

  test('unlink deletes file', async () => {
    const filePath = join(testDir, 'to-delete.txt');
    await writeText(filePath, 'delete me');
    expect(await exists(filePath)).toBe(true);

    await unlink(filePath);
    expect(await exists(filePath)).toBe(false);
  });

  test('stat throws BlobError for non-existent file', async () => {
    const fakePath = join(testDir, 'no-such-file.txt');
    try {
      await stat(fakePath);
      expect(true).toBe(false); // Should not reach here
    } catch (e) {
      expect(e instanceof BlobError).toBe(true);
    }
  });

  test('nested directory creation', async () => {
    const nestedDir = join(testDir, 'nested', 'deep');
    await mkdir(nestedDir);
    const result = await exists(nestedDir);
    expect(result).toBe(true);
  });
});
