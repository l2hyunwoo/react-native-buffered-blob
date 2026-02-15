// Mock NativeBufferedBlob before any imports
jest.mock('../NativeBufferedBlob');

import { wrapReader, wrapWriter } from '../wrappers';
import type { StreamingProxy } from '../module';
import { BlobError, ErrorCode } from '../errors';

describe('wrapReader', () => {
  let mockStreaming: jest.Mocked<StreamingProxy>;

  beforeEach(() => {
    mockStreaming = {
      readNextChunk: jest.fn(),
      write: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
      startDownload: jest.fn(),
      cancelDownload: jest.fn(),
      getReaderInfo: jest.fn((_handleId: number) => ({
        fileSize: 1024,
        bytesRead: 512,
        isEOF: false,
      })),
      getWriterInfo: jest.fn((_handleId: number) => ({
        bytesWritten: 256,
      })),
    };
  });

  it('should expose correct handleId', () => {
    const reader = wrapReader(42, mockStreaming);
    expect(reader.handleId).toBe(42);
  });

  it('should delegate readNextChunk to streaming proxy', async () => {
    const mockBuffer = new ArrayBuffer(8);
    mockStreaming.readNextChunk.mockResolvedValue(mockBuffer);

    const reader = wrapReader(1, mockStreaming);
    const result = await reader.readNextChunk();

    expect(mockStreaming.readNextChunk).toHaveBeenCalledWith(1);
    expect(result).toBe(mockBuffer);
  });

  it('should call getReaderInfo for property getters', () => {
    const reader = wrapReader(5, mockStreaming);

    expect(reader.fileSize).toBe(1024);
    expect(reader.bytesRead).toBe(512);
    expect(reader.isEOF).toBe(false);

    expect(mockStreaming.getReaderInfo).toHaveBeenCalledTimes(3);
    expect(mockStreaming.getReaderInfo).toHaveBeenCalledWith(5);
  });

  it('should close() and call streaming.close', () => {
    const reader = wrapReader(3, mockStreaming);
    reader.close();

    expect(mockStreaming.close).toHaveBeenCalledWith(3);
    expect(mockStreaming.close).toHaveBeenCalledTimes(1);
  });

  it('should be idempotent (second close does not call native)', () => {
    const reader = wrapReader(3, mockStreaming);
    reader.close();
    reader.close();

    expect(mockStreaming.close).toHaveBeenCalledTimes(1);
  });

  it('should throw BlobError(READER_CLOSED) after close', () => {
    const reader = wrapReader(3, mockStreaming);
    reader.close();

    expect(() => reader.readNextChunk()).toThrow(BlobError);
    expect(() => reader.readNextChunk()).toThrow(
      expect.objectContaining({
        code: ErrorCode.READER_CLOSED,
        message: 'Reader is already closed',
      })
    );
  });

  it('should support Symbol.dispose', () => {
    const reader = wrapReader(7, mockStreaming);
    reader[Symbol.dispose]();

    expect(mockStreaming.close).toHaveBeenCalledWith(7);
  });

  it('should be idempotent with Symbol.dispose', () => {
    const reader = wrapReader(7, mockStreaming);
    reader[Symbol.dispose]();
    reader[Symbol.dispose]();

    expect(mockStreaming.close).toHaveBeenCalledTimes(1);
  });
});

describe('wrapWriter', () => {
  let mockStreaming: jest.Mocked<StreamingProxy>;

  beforeEach(() => {
    mockStreaming = {
      readNextChunk: jest.fn(),
      write: jest.fn(),
      flush: jest.fn(),
      close: jest.fn(),
      startDownload: jest.fn(),
      cancelDownload: jest.fn(),
      getReaderInfo: jest.fn((_handleId: number) => ({
        fileSize: 1024,
        bytesRead: 512,
        isEOF: false,
      })),
      getWriterInfo: jest.fn((_handleId: number) => ({
        bytesWritten: 256,
      })),
    };
  });

  it('should expose correct handleId', () => {
    const writer = wrapWriter(99, mockStreaming);
    expect(writer.handleId).toBe(99);
  });

  it('should delegate write to streaming proxy', async () => {
    mockStreaming.write.mockResolvedValue(128);

    const writer = wrapWriter(2, mockStreaming);
    const buffer = new ArrayBuffer(128);
    const bytesWritten = await writer.write(buffer);

    expect(mockStreaming.write).toHaveBeenCalledWith(2, buffer);
    expect(bytesWritten).toBe(128);
  });

  it('should delegate flush to streaming proxy', async () => {
    mockStreaming.flush.mockResolvedValue(undefined);

    const writer = wrapWriter(4, mockStreaming);
    await writer.flush();

    expect(mockStreaming.flush).toHaveBeenCalledWith(4);
  });

  it('should call getWriterInfo for bytesWritten getter', () => {
    const writer = wrapWriter(6, mockStreaming);

    expect(writer.bytesWritten).toBe(256);
    expect(mockStreaming.getWriterInfo).toHaveBeenCalledWith(6);
  });

  it('should close() and call streaming.close', () => {
    const writer = wrapWriter(8, mockStreaming);
    writer.close();

    expect(mockStreaming.close).toHaveBeenCalledWith(8);
    expect(mockStreaming.close).toHaveBeenCalledTimes(1);
  });

  it('should be idempotent (second close does not call native)', () => {
    const writer = wrapWriter(8, mockStreaming);
    writer.close();
    writer.close();

    expect(mockStreaming.close).toHaveBeenCalledTimes(1);
  });

  it('should throw BlobError(WRITER_CLOSED) after close on write', () => {
    const writer = wrapWriter(10, mockStreaming);
    writer.close();

    const buffer = new ArrayBuffer(8);
    expect(() => writer.write(buffer)).toThrow(BlobError);
    expect(() => writer.write(buffer)).toThrow(
      expect.objectContaining({
        code: ErrorCode.WRITER_CLOSED,
        message: 'Writer is already closed',
      })
    );
  });

  it('should throw BlobError(WRITER_CLOSED) after close on flush', () => {
    const writer = wrapWriter(10, mockStreaming);
    writer.close();

    expect(() => writer.flush()).toThrow(BlobError);
    expect(() => writer.flush()).toThrow(
      expect.objectContaining({
        code: ErrorCode.WRITER_CLOSED,
        message: 'Writer is already closed',
      })
    );
  });

  it('should support Symbol.dispose', () => {
    const writer = wrapWriter(11, mockStreaming);
    writer[Symbol.dispose]();

    expect(mockStreaming.close).toHaveBeenCalledWith(11);
  });

  it('should be idempotent with Symbol.dispose', () => {
    const writer = wrapWriter(11, mockStreaming);
    writer[Symbol.dispose]();
    writer[Symbol.dispose]();

    expect(mockStreaming.close).toHaveBeenCalledTimes(1);
  });
});
