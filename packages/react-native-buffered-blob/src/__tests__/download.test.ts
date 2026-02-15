// Mock NativeBufferedBlob before any imports
jest.mock('../NativeBufferedBlob');

import NativeModule from '../NativeBufferedBlob';
import { download } from '../api/download';
import { BlobError, ErrorCode } from '../errors';
import type { StreamingProxy } from '../module';

describe('download', () => {
  let mockStreaming: jest.Mocked<StreamingProxy>;

  beforeAll(() => {
    mockStreaming = {
      readNextChunk: jest.fn(),
      write: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
      startDownload: jest.fn(),
      cancelDownload: jest.fn(),
      getReaderInfo: jest.fn((_handleId: number) => ({
        fileSize: 1024,
        bytesRead: 0,
        isEOF: false,
      })),
      getWriterInfo: jest.fn((_handleId: number) => ({
        bytesWritten: 0,
      })),
    };
    globalThis.__BufferedBlobStreaming = mockStreaming;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (NativeModule.createDownload as jest.Mock).mockReturnValue(10);
    mockStreaming.startDownload.mockResolvedValue(undefined);
  });

  it('should call createDownload with correct args', () => {
    const headers = { Authorization: 'Bearer token' };
    download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
      headers,
    });

    expect(NativeModule.createDownload).toHaveBeenCalledWith(
      'https://example.com/file.zip',
      '/downloads/file.zip',
      headers
    );
  });

  it('should use empty headers object by default', () => {
    download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    expect(NativeModule.createDownload).toHaveBeenCalledWith(
      'https://example.com/file.zip',
      '/downloads/file.zip',
      {}
    );
  });

  it('should resolve promise on success', async () => {
    const { promise } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    await expect(promise).resolves.toBeUndefined();
    expect(mockStreaming.startDownload).toHaveBeenCalledWith(
      10,
      expect.any(Function)
    );
  });

  it('should reject promise on error', async () => {
    mockStreaming.startDownload.mockRejectedValue(
      new Error('[DOWNLOAD_FAILED] Network error')
    );

    const { promise } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    await expect(promise).rejects.toThrow('[DOWNLOAD_FAILED] Network error');
  });

  it('should call closeHandle in finally', async () => {
    (NativeModule.createDownload as jest.Mock).mockReturnValue(99);

    const { promise } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    await promise;

    expect(NativeModule.closeHandle).toHaveBeenCalledWith(99);
  });

  it('should call closeHandle even on error', async () => {
    (NativeModule.createDownload as jest.Mock).mockReturnValue(88);
    mockStreaming.startDownload.mockRejectedValue(new Error('Download failed'));

    const { promise } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    await promise.catch(() => {});

    expect(NativeModule.closeHandle).toHaveBeenCalledWith(88);
  });

  it('should forward progress callback', async () => {
    const onProgress = jest.fn();
    (NativeModule.createDownload as jest.Mock).mockReturnValue(50);

    const { promise } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
      onProgress,
    });

    // Get the callback passed to startDownload
    expect(mockStreaming.startDownload).toHaveBeenCalledWith(
      50,
      expect.any(Function)
    );
    const progressCallback = mockStreaming.startDownload.mock.calls[0]?.[1];

    // Simulate progress update
    progressCallback!(512, 1024, 0.5);

    expect(onProgress).toHaveBeenCalledWith({
      bytesDownloaded: 512,
      totalBytes: 1024,
      progress: 0.5,
    });

    await promise;
  });

  it('should handle missing onProgress callback', async () => {
    (NativeModule.createDownload as jest.Mock).mockReturnValue(60);

    const { promise } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    expect(mockStreaming.startDownload).toHaveBeenCalledWith(
      60,
      expect.any(Function)
    );
    const progressCallback = mockStreaming.startDownload.mock.calls[0]?.[1];

    // Should not throw when called
    expect(() => progressCallback!(512, 1024, 0.5)).not.toThrow();

    await promise;
  });

  it('should return cancel function that calls cancelDownload', () => {
    (NativeModule.createDownload as jest.Mock).mockReturnValue(77);

    const { cancel } = download({
      url: 'https://example.com/file.zip',
      destPath: '/downloads/file.zip',
    });

    cancel();

    expect(mockStreaming.cancelDownload).toHaveBeenCalledWith(77);
  });

  it('should wrap creation errors with path', () => {
    (NativeModule.createDownload as jest.Mock).mockImplementation(() => {
      throw new Error('[PERMISSION_DENIED] Cannot write to destination');
    });

    expect(() =>
      download({
        url: 'https://example.com/file.zip',
        destPath: '/protected/file.zip',
      })
    ).toThrow(BlobError);
    expect(() =>
      download({
        url: 'https://example.com/file.zip',
        destPath: '/protected/file.zip',
      })
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.PERMISSION_DENIED,
        path: '/protected/file.zip',
      })
    );
  });
});
