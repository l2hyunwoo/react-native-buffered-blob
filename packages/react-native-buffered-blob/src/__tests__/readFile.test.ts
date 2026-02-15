// Mock NativeBufferedBlob before any imports
jest.mock('../NativeBufferedBlob');

import NativeModule from '../NativeBufferedBlob';
import { createReader } from '../api/readFile';
import { BlobError, ErrorCode } from '../errors';
import type { StreamingProxy } from '../module';

// Set up global streaming proxy
beforeAll(() => {
  const mockStreaming: StreamingProxy = {
    readNextChunk: jest.fn(),
    write: jest.fn(),
    flush: jest.fn(),
    close: jest.fn(),
    startDownload: jest.fn(),
    cancelDownload: jest.fn(),
    getReaderInfo: jest.fn(() => ({
      fileSize: 1024,
      bytesRead: 0,
      isEOF: false,
    })),
    getWriterInfo: jest.fn(() => ({
      bytesWritten: 0,
    })),
  };
  globalThis.__BufferedBlobStreaming = mockStreaming;
});

describe('createReader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModule.openRead as jest.Mock).mockReturnValue(1);
  });

  it('should return a BlobReader with correct handleId', () => {
    (NativeModule.openRead as jest.Mock).mockReturnValue(42);

    const reader = createReader('/test/file.txt');

    expect(NativeModule.openRead).toHaveBeenCalledWith('/test/file.txt', 65536);
    expect(reader.handleId).toBe(42);
  });

  it('should use default bufferSize of 64KB', () => {
    createReader('/test/file.txt');

    expect(NativeModule.openRead).toHaveBeenCalledWith('/test/file.txt', 65536);
  });

  it('should pass custom bufferSize', () => {
    createReader('/test/file.txt', 8192);

    expect(NativeModule.openRead).toHaveBeenCalledWith('/test/file.txt', 8192);
  });

  it('should throw INVALID_ARGUMENT for bufferSize below minimum', () => {
    expect(() => createReader('/test/file.txt', 2048)).toThrow(BlobError);
    expect(() => createReader('/test/file.txt', 2048)).toThrow(
      expect.objectContaining({
        code: ErrorCode.INVALID_ARGUMENT,
        message: expect.stringContaining(
          'bufferSize must be between 4096 and 4194304'
        ),
        path: '/test/file.txt',
      })
    );
  });

  it('should throw INVALID_ARGUMENT for bufferSize above maximum', () => {
    expect(() => createReader('/test/file.txt', 100000000)).toThrow(BlobError);
    expect(() => createReader('/test/file.txt', 100000000)).toThrow(
      expect.objectContaining({
        code: ErrorCode.INVALID_ARGUMENT,
        message: expect.stringContaining(
          'bufferSize must be between 4096 and 4194304'
        ),
      })
    );
  });

  it('should throw INVALID_ARGUMENT for non-finite bufferSize', () => {
    expect(() => createReader('/test/file.txt', NaN)).toThrow(BlobError);
    expect(() => createReader('/test/file.txt', Infinity)).toThrow(BlobError);
  });

  it('should throw IO_ERROR when native returns -1', () => {
    (NativeModule.openRead as jest.Mock).mockReturnValue(-1);

    expect(() => createReader('/test/file.txt')).toThrow(BlobError);
    expect(() => createReader('/test/file.txt')).toThrow(
      expect.objectContaining({
        code: ErrorCode.IO_ERROR,
        message: 'Failed to open file for reading',
        path: '/test/file.txt',
      })
    );
  });

  it('should wrap native errors with path', () => {
    (NativeModule.openRead as jest.Mock).mockImplementation(() => {
      throw new Error('[FILE_NOT_FOUND] File does not exist');
    });

    expect(() => createReader('/missing.txt')).toThrow(BlobError);
    expect(() => createReader('/missing.txt')).toThrow(
      expect.objectContaining({
        code: ErrorCode.FILE_NOT_FOUND,
        message: 'File does not exist',
        path: '/missing.txt',
      })
    );
  });
});
