// Mock NativeBufferedBlob before any imports
jest.mock('../NativeBufferedBlob');

import NativeModule from '../NativeBufferedBlob';
import { hashFile } from '../api/hash';
import { HashAlgorithm } from '../types';
import { BlobError, ErrorCode } from '../errors';

describe('hashFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should use SHA256 by default', async () => {
    (NativeModule.hashFile as jest.Mock).mockResolvedValue('abc123');

    const result = await hashFile('/test/file.txt');

    expect(NativeModule.hashFile).toHaveBeenCalledWith(
      '/test/file.txt',
      HashAlgorithm.SHA256
    );
    expect(result).toBe('abc123');
  });

  it('should accept MD5 algorithm', async () => {
    (NativeModule.hashFile as jest.Mock).mockResolvedValue('def456');

    const result = await hashFile('/test/file.txt', HashAlgorithm.MD5);

    expect(NativeModule.hashFile).toHaveBeenCalledWith(
      '/test/file.txt',
      HashAlgorithm.MD5
    );
    expect(result).toBe('def456');
  });

  it('should accept SHA256 algorithm explicitly', async () => {
    (NativeModule.hashFile as jest.Mock).mockResolvedValue('789ghi');

    const result = await hashFile('/test/file.txt', HashAlgorithm.SHA256);

    expect(NativeModule.hashFile).toHaveBeenCalledWith(
      '/test/file.txt',
      HashAlgorithm.SHA256
    );
    expect(result).toBe('789ghi');
  });

  it('should wrap errors with path', async () => {
    (NativeModule.hashFile as jest.Mock).mockRejectedValue(
      new Error('[FILE_NOT_FOUND] File does not exist')
    );

    await expect(hashFile('/missing.txt')).rejects.toThrow(BlobError);
    await expect(hashFile('/missing.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND,
        path: '/missing.txt',
      })
    );
  });

  it('should handle IO errors', async () => {
    (NativeModule.hashFile as jest.Mock).mockRejectedValue(
      new Error('[IO_ERROR] Failed to read file')
    );

    await expect(hashFile('/test/file.txt')).rejects.toThrow(BlobError);
    await expect(hashFile('/test/file.txt')).rejects.toThrow(
      expect.objectContaining({
        code: ErrorCode.IO_ERROR,
        message: 'Failed to read file',
        path: '/test/file.txt',
      })
    );
  });
});
