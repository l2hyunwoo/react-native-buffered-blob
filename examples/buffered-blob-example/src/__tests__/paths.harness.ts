import { describe, test, expect } from 'react-native-harness';
import {
  Dirs,
  join,
  dirname,
  basename,
  extname,
} from 'react-native-buffered-blob';

describe('Paths', () => {
  test('Dirs.document is a non-empty string', () => {
    expect(typeof Dirs.document).toBe('string');
    expect(Dirs.document.length).toBeGreaterThan(0);
  });

  test('Dirs.cache is a non-empty string', () => {
    expect(typeof Dirs.cache).toBe('string');
    expect(Dirs.cache.length).toBeGreaterThan(0);
  });

  test('Dirs.temp is a non-empty string', () => {
    expect(typeof Dirs.temp).toBe('string');
    expect(Dirs.temp.length).toBeGreaterThan(0);
  });

  test('join combines paths correctly', () => {
    const result = join('/base', 'sub', 'file.txt');
    expect(result).toBe('/base/sub/file.txt');
  });

  test('join normalizes duplicate slashes', () => {
    const result = join('/base/', '/sub/', '/file.txt');
    expect(result).toBe('/base/sub/file.txt');
  });

  test('join filters empty parts', () => {
    const result = join('/base', '', 'file.txt');
    expect(result).toBe('/base/file.txt');
  });

  test('dirname returns parent directory', () => {
    const result = dirname('/base/sub/file.txt');
    expect(result).toBe('/base/sub');
  });

  test('basename returns file name', () => {
    const result = basename('/base/sub/file.txt');
    expect(result).toBe('file.txt');
  });

  test('basename with extension strips it', () => {
    const result = basename('/base/sub/file.txt', '.txt');
    expect(result).toBe('file');
  });

  test('extname returns file extension', () => {
    const result = extname('/base/sub/file.txt');
    expect(result).toBe('.txt');
  });

  test('extname returns empty for files without extension', () => {
    const result = extname('/base/sub/Makefile');
    expect(result).toBe('');
  });
});
