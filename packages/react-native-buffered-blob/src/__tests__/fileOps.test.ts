// Mock NativeBufferedBlob before any imports
jest.mock('../NativeBufferedBlob');

import NativeModule from '../NativeBufferedBlob';
import { exists, stat, unlink, mkdir, ls, cp, mv } from '../api/fileOps';
import { FileType } from '../types';
import { BlobError, ErrorCode } from '../errors';

describe('exists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve with boolean', async () => {
    (NativeModule.exists as jest.Mock).mockResolvedValue(true);

    const result = await exists('/test/file.txt');

    expect(result).toBe(true);
    expect(NativeModule.exists).toHaveBeenCalledWith('/test/file.txt');
  });

  it('should wrap errors with path', async () => {
    (NativeModule.exists as jest.Mock).mockRejectedValue(
      new Error('[PERMISSION_DENIED] Cannot access path')
    );

    await expect(exists('/protected/file.txt')).rejects.toThrow(BlobError);
    await expect(exists('/protected/file.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.PERMISSION_DENIED,
        path: '/protected/file.txt',
      })
    );
  });
});

describe('stat', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should map raw response to FileInfo correctly', async () => {
    const rawResponse = {
      path: '/test/file.txt',
      name: 'file.txt',
      size: 2048,
      type: 'file',
      lastModified: 1234567890,
    };
    (NativeModule.stat as jest.Mock).mockResolvedValue(rawResponse);

    const result = await stat('/test/file.txt');

    expect(result).toEqual({
      path: '/test/file.txt',
      name: 'file.txt',
      size: 2048,
      type: FileType.FILE,
      lastModified: 1234567890,
    });
    expect(NativeModule.stat).toHaveBeenCalledWith('/test/file.txt');
  });

  it('should map file type correctly', async () => {
    (NativeModule.stat as jest.Mock).mockResolvedValue({
      path: '/test',
      name: 'test',
      size: 0,
      type: 'file',
      lastModified: 0,
    });

    const fileResult = await stat('/test');
    expect(fileResult.type).toBe(FileType.FILE);
  });

  it('should map directory type correctly', async () => {
    (NativeModule.stat as jest.Mock).mockResolvedValue({
      path: '/test',
      name: 'test',
      size: 0,
      type: 'directory',
      lastModified: 0,
    });

    const dirResult = await stat('/test');
    expect(dirResult.type).toBe(FileType.DIRECTORY);
  });

  it('should map unknown type correctly', async () => {
    (NativeModule.stat as jest.Mock).mockResolvedValue({
      path: '/test',
      name: 'test',
      size: 0,
      type: 'symlink',
      lastModified: 0,
    });

    const unknownResult = await stat('/test');
    expect(unknownResult.type).toBe(FileType.UNKNOWN);
  });

  it('should wrap errors with path', async () => {
    (NativeModule.stat as jest.Mock).mockRejectedValue(
      new Error('[FILE_NOT_FOUND] File does not exist')
    );

    await expect(stat('/missing.txt')).rejects.toThrow(BlobError);
    await expect(stat('/missing.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND,
        path: '/missing.txt',
      })
    );
  });
});

describe('unlink', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call native unlink', async () => {
    (NativeModule.unlink as jest.Mock).mockResolvedValue(undefined);

    await unlink('/test/file.txt');

    expect(NativeModule.unlink).toHaveBeenCalledWith('/test/file.txt');
  });

  it('should wrap errors with path', async () => {
    (NativeModule.unlink as jest.Mock).mockRejectedValue(
      new Error('[FILE_NOT_FOUND] File does not exist')
    );

    await expect(unlink('/missing.txt')).rejects.toThrow(BlobError);
    await expect(unlink('/missing.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND,
        path: '/missing.txt',
      })
    );
  });
});

describe('mkdir', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call native mkdir', async () => {
    (NativeModule.mkdir as jest.Mock).mockResolvedValue(undefined);

    await mkdir('/test/newdir');

    expect(NativeModule.mkdir).toHaveBeenCalledWith('/test/newdir');
  });

  it('should wrap errors with path', async () => {
    (NativeModule.mkdir as jest.Mock).mockRejectedValue(
      new Error('[FILE_ALREADY_EXISTS] Directory already exists')
    );

    await expect(mkdir('/existing')).rejects.toThrow(BlobError);
    await expect(mkdir('/existing')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_ALREADY_EXISTS,
        path: '/existing',
      })
    );
  });
});

describe('ls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should map array of raw responses', async () => {
    const rawList = [
      {
        path: '/test/file1.txt',
        name: 'file1.txt',
        size: 100,
        type: 'file',
        lastModified: 1000,
      },
      {
        path: '/test/subdir',
        name: 'subdir',
        size: 0,
        type: 'directory',
        lastModified: 2000,
      },
    ];
    (NativeModule.ls as jest.Mock).mockResolvedValue(rawList);

    const result = await ls('/test');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      path: '/test/file1.txt',
      name: 'file1.txt',
      size: 100,
      type: FileType.FILE,
      lastModified: 1000,
    });
    expect(result[1]).toEqual({
      path: '/test/subdir',
      name: 'subdir',
      size: 0,
      type: FileType.DIRECTORY,
      lastModified: 2000,
    });
    expect(NativeModule.ls).toHaveBeenCalledWith('/test');
  });

  it('should return empty array for empty directory', async () => {
    (NativeModule.ls as jest.Mock).mockResolvedValue([]);

    const result = await ls('/empty');

    expect(result).toEqual([]);
  });

  it('should wrap errors with path', async () => {
    (NativeModule.ls as jest.Mock).mockRejectedValue(
      new Error('[NOT_A_DIRECTORY] Path is not a directory')
    );

    await expect(ls('/file.txt')).rejects.toThrow(BlobError);
    await expect(ls('/file.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.NOT_A_DIRECTORY,
        path: '/file.txt',
      })
    );
  });
});

describe('cp', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should forward arguments correctly', async () => {
    (NativeModule.cp as jest.Mock).mockResolvedValue(undefined);

    await cp('/source/file.txt', '/dest/file.txt');

    expect(NativeModule.cp).toHaveBeenCalledWith(
      '/source/file.txt',
      '/dest/file.txt'
    );
  });

  it('should wrap errors with source path', async () => {
    (NativeModule.cp as jest.Mock).mockRejectedValue(
      new Error('[FILE_NOT_FOUND] Source file does not exist')
    );

    await expect(cp('/missing.txt', '/dest.txt')).rejects.toThrow(BlobError);
    await expect(cp('/missing.txt', '/dest.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND,
        path: '/missing.txt',
      })
    );
  });
});

describe('mv', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should forward arguments correctly', async () => {
    (NativeModule.mv as jest.Mock).mockResolvedValue(undefined);

    await mv('/source/file.txt', '/dest/file.txt');

    expect(NativeModule.mv).toHaveBeenCalledWith(
      '/source/file.txt',
      '/dest/file.txt'
    );
  });

  it('should wrap errors with source path', async () => {
    (NativeModule.mv as jest.Mock).mockRejectedValue(
      new Error('[FILE_NOT_FOUND] Source file does not exist')
    );

    await expect(mv('/missing.txt', '/dest.txt')).rejects.toThrow(BlobError);
    await expect(mv('/missing.txt', '/dest.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND,
        path: '/missing.txt',
      })
    );
  });
});
