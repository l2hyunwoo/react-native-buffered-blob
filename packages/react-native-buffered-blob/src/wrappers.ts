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
    [Symbol.dispose]() {
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
    /**
     * Write data to the file.
     *
     * **Backpressure warning:** Each call queues data to the native write
     * pipeline. You MUST await each write() call before issuing the next
     * one. Failing to await writes can cause unbounded memory growth as
     * ArrayBuffer copies accumulate in the native queue.
     *
     * @example
     * ```ts
     * // Correct - sequential writes with await
     * for (const chunk of chunks) {
     *   await writer.write(chunk);
     * }
     *
     * // WRONG - parallel writes without backpressure
     * chunks.forEach(chunk => writer.write(chunk)); // Do NOT do this
     * ```
     *
     * @param data - The ArrayBuffer to write
     * @returns Promise resolving to the number of bytes written
     */
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
    [Symbol.dispose]() {
      if (!closed) {
        closed = true;
        streaming.close(handleId);
      }
    },
  };
}
