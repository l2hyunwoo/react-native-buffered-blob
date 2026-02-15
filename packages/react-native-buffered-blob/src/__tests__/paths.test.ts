// Mock NativeBufferedBlob before importing paths (which imports module.ts)
jest.mock('../NativeBufferedBlob');

import { join, dirname, basename, extname } from '../paths';

describe('join', () => {
  it('should combine path segments with /', () => {
    expect(join('a', 'b', 'c')).toBe('a/b/c');
    expect(join('/root', 'sub', 'file.txt')).toBe('/root/sub/file.txt');
  });

  it('should remove duplicate slashes', () => {
    expect(join('a/', '/b', 'c')).toBe('a/b/c');
    expect(join('a//', '//b', 'c')).toBe('a/b/c');
  });

  it('should handle empty segments', () => {
    expect(join('a', '', 'b')).toBe('a/b');
    expect(join('', 'a', 'b', '')).toBe('a/b');
  });

  it('should preserve leading /', () => {
    expect(join('/a', 'b')).toBe('/a/b');
    expect(join('/', 'a', 'b')).toBe('/a/b');
  });

  it('should remove trailing /', () => {
    expect(join('a', 'b', 'c/')).toBe('a/b/c');
    expect(join('a/', 'b/')).toBe('a/b');
  });

  it('should handle single segment', () => {
    expect(join('a')).toBe('a');
    expect(join('/a')).toBe('/a');
  });

  it('should preserve root path', () => {
    expect(join('/')).toBe('/');
  });
});

describe('dirname', () => {
  it('should return parent directory', () => {
    expect(dirname('/a/b/c')).toBe('/a/b');
    expect(dirname('a/b/c')).toBe('a/b');
  });

  it('should handle root paths', () => {
    expect(dirname('/a')).toBe('');
    expect(dirname('/')).toBe('');
  });

  it('should return . for bare filename', () => {
    expect(dirname('file.txt')).toBe('.');
    expect(dirname('abc')).toBe('.');
  });

  it('should handle path with trailing slash', () => {
    expect(dirname('/a/b/')).toBe('/a/b');
  });
});

describe('basename', () => {
  it('should extract filename', () => {
    expect(basename('/a/b/c.txt')).toBe('c.txt');
    expect(basename('a/b/c')).toBe('c');
    expect(basename('file.txt')).toBe('file.txt');
  });

  it('should remove extension when provided', () => {
    expect(basename('/a/b/c.txt', '.txt')).toBe('c');
    expect(basename('file.js', '.js')).toBe('file');
  });

  it('should not remove non-matching extension', () => {
    expect(basename('file.txt', '.js')).toBe('file.txt');
  });

  it('should handle files without extension', () => {
    expect(basename('/a/b/c')).toBe('c');
    expect(basename('README')).toBe('README');
  });

  it('should handle root path', () => {
    expect(basename('/')).toBe('');
  });
});

describe('extname', () => {
  it('should extract file extension', () => {
    expect(extname('file.txt')).toBe('.txt');
    expect(extname('archive.tar.gz')).toBe('.gz');
    expect(extname('/a/b/c.js')).toBe('.js');
  });

  it('should return empty for no extension', () => {
    expect(extname('file')).toBe('');
    expect(extname('README')).toBe('');
  });

  it('should handle dotfiles', () => {
    expect(extname('.gitignore')).toBe('');
    expect(extname('.env.local')).toBe('.local');
  });

  it('should handle paths with directories', () => {
    expect(extname('/a/b/file.txt')).toBe('.txt');
    expect(extname('a.b/c.d/file.txt')).toBe('.txt');
  });

  it('should handle trailing dot', () => {
    expect(extname('file.')).toBe('.');
  });
});
