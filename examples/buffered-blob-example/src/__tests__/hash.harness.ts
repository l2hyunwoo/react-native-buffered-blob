import {
  describe,
  test,
  expect,
  beforeEach,
  afterEach,
} from 'react-native-harness';
import {
  hashFile,
  createWriter,
  mkdir,
  unlink,
  ls,
  Dirs,
  join,
  HashAlgorithm,
} from 'react-native-buffered-blob';

const encoder = new TextEncoder();

async function writeText(path: string, content: string): Promise<void> {
  const data = encoder.encode(content);
  const writer = createWriter(path);
  await writer.write(data.buffer as ArrayBuffer);
  await writer.flush();
  writer.close();
}

describe('Hash', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(Dirs.temp, `harness-hash-${Date.now()}`);
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

  test('hashFile with SHA256 produces consistent hash', async () => {
    const filePath = join(testDir, 'sha256.txt');
    await writeText(filePath, 'hello world');

    const hash1 = await hashFile(filePath, HashAlgorithm.SHA256);
    const hash2 = await hashFile(filePath, HashAlgorithm.SHA256);

    expect(hash1).toBe(hash2);
    // Known SHA-256 of "hello world"
    expect(hash1).toBe(
      'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
    );
  });

  test('hashFile with MD5 produces consistent hash', async () => {
    const filePath = join(testDir, 'md5.txt');
    await writeText(filePath, 'hello world');

    const hash1 = await hashFile(filePath, HashAlgorithm.MD5);
    const hash2 = await hashFile(filePath, HashAlgorithm.MD5);

    expect(hash1).toBe(hash2);
    // Known MD5 of "hello world"
    expect(hash1).toBe('5eb63bbbe01eeed093cb22bb8f5acdc3');
  });

  test('same content produces same hash', async () => {
    const file1 = join(testDir, 'same1.txt');
    const file2 = join(testDir, 'same2.txt');
    const content = 'identical content for hashing';
    await writeText(file1, content);
    await writeText(file2, content);

    const hash1 = await hashFile(file1, HashAlgorithm.SHA256);
    const hash2 = await hashFile(file2, HashAlgorithm.SHA256);

    expect(hash1).toBe(hash2);
  });

  test('different content produces different hash', async () => {
    const file1 = join(testDir, 'diff1.txt');
    const file2 = join(testDir, 'diff2.txt');
    await writeText(file1, 'content alpha');
    await writeText(file2, 'content beta');

    const hash1 = await hashFile(file1, HashAlgorithm.SHA256);
    const hash2 = await hashFile(file2, HashAlgorithm.SHA256);

    expect(hash1).not.toBe(hash2);
  });
});
