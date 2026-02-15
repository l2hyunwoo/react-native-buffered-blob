// Mock NativeBufferedBlob before any imports
jest.mock('../NativeBufferedBlob');

import NativeModule from '../NativeBufferedBlob';
import { createWriter } from '../api/writeFile';
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

describe('createWriter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModule.openWrite as jest.Mock).mockReturnValue(2);
  });

  it('should return a BlobWriter with correct handleId', () => {
    (NativeModule.openWrite as jest.Mock).mockReturnValue(55);

    const writer = createWriter('/test/output.txt');

    expect(NativeModule.openWrite).toHaveBeenCalledWith(
      '/test/output.txt',
      false
    );
    expect(writer.handleId).toBe(55);
  });

  it('should pass append flag as false by default', () => {
    createWriter('/test/file.txt');

    expect(NativeModule.openWrite).toHaveBeenCalledWith(
      '/test/file.txt',
      false
    );
  });

  it('should pass append flag when provided', () => {
    createWriter('/test/file.txt', true);

    expect(NativeModule.openWrite).toHaveBeenCalledWith('/test/file.txt', true);
  });

  it('should throw IO_ERROR when native returns -1', () => {
    (NativeModule.openWrite as jest.Mock).mockReturnValue(-1);

    expect(() => createWriter('/test/file.txt')).toThrow(BlobError);
    expect(() => createWriter('/test/file.txt')).toThrow(
      expect.objectContaining({
        code: ErrorCode.IO_ERROR,
        message: 'Failed to open file for writing',
        path: '/test/file.txt',
      })
    );
  });

  it('should wrap native errors with path', () => {
    (NativeModule.openWrite as jest.Mock).mockImplementation(() => {
      throw new Error('[PERMISSION_DENIED] Cannot write to directory');
    });

    expect(() => createWriter('/readonly/file.txt')).toThrow(BlobError);
    expect(() => createWriter('/readonly/file.txt')).toThrow(
      expect.objectContaining({
        code: ErrorCode.PERMISSION_DENIED,
        message: 'Cannot write to directory',
        path: '/readonly/file.txt',
      })
    );
  });
});
