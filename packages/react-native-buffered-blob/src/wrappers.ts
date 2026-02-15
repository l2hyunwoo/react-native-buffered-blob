import type { StreamingProxy } from './module';
import type { BlobReader, BlobWriter } from './types';
import { BlobError, ErrorCode } from './errors';

/**
 * Wraps a native reader handle with explicit getter delegation.
 * IMPORTANT: Does NOT use spread operator on HostObject (getters would be lost).
 * Instead, proxies each property access through getReaderInfo().
 */
export function wrapReader(
  handleId: number,
  streaming: StreamingProxy
): BlobReader {
  let closed = false;

  return {
    get handleId() {
      return handleId;
    },
    get fileSize() {
      return streaming.getReaderInfo(handleId).fileSize;
    },
    get bytesRead() {
      return streaming.getReaderInfo(handleId).bytesRead;
    },
    get isEOF() {
      return streaming.getReaderInfo(handleId).isEOF;
    },
    readNextChunk() {
      if (closed) {
        throw new BlobError(
          ErrorCode.READER_CLOSED,
          'Reader is already closed'
        );
      }
      return streaming.readNextChunk(handleId);
    },
    close() {
      if (!closed) {
        closed = true;
        streaming.close(handleId);
      }
    },
  };
}

/**
 * Wraps a native writer handle with explicit getter delegation.
 * IMPORTANT: Does NOT use spread operator on HostObject (getters would be lost).
 */
export function wrapWriter(
  handleId: number,
  streaming: StreamingProxy
): BlobWriter {
  let closed = false;

  return {
    get handleId() {
      return handleId;
    },
    get bytesWritten() {
      return streaming.getWriterInfo(handleId).bytesWritten;
    },
    write(data: ArrayBuffer) {
      if (closed) {
        throw new BlobError(
          ErrorCode.WRITER_CLOSED,
          'Writer is already closed'
        );
      }
      return streaming.write(handleId, data);
    },
    flush() {
      if (closed) {
        throw new BlobError(
          ErrorCode.WRITER_CLOSED,
          'Writer is already closed'
        );
      }
      return streaming.flush(handleId);
    },
    close() {
      if (!closed) {
        closed = true;
        streaming.close(handleId);
      }
    },
  };
}
