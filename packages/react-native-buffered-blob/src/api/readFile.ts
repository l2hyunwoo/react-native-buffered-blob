import { NativeModule, getStreamingProxy } from '../module';
import { wrapError, BlobError, ErrorCode } from '../errors';
import { wrapReader } from '../wrappers';
import type { BlobReader } from '../types';

const DEFAULT_BUFFER_SIZE = 65536; // 64KB

export function createReader(
  path: string,
  bufferSize: number = DEFAULT_BUFFER_SIZE
): BlobReader {
  try {
    if (
      !Number.isFinite(bufferSize) ||
      bufferSize < 4096 ||
      bufferSize > 4194304
    ) {
      throw new BlobError(
        ErrorCode.INVALID_ARGUMENT,
        `bufferSize must be between 4096 and 4194304, got ${bufferSize}`,
        path
      );
    }
    const handleId = NativeModule.openRead(path, bufferSize);
    if (handleId < 0) {
      throw new BlobError(
        ErrorCode.IO_ERROR,
        'Failed to open file for reading',
        path
      );
    }
    const streaming = getStreamingProxy();
    return wrapReader(handleId, streaming);
  } catch (e) {
    throw wrapError(e, path);
  }
}
