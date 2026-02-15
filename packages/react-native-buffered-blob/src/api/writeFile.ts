import { NativeModule, getStreamingProxy } from '../module';
import { wrapError, BlobError, ErrorCode } from '../errors';
import { wrapWriter } from '../wrappers';
import type { BlobWriter } from '../types';

export function createWriter(
  path: string,
  append: boolean = false
): BlobWriter {
  try {
    const handleId = NativeModule.openWrite(path, append);
    if (handleId < 0) {
      throw new BlobError(
        ErrorCode.IO_ERROR,
        'Failed to open file for writing',
        path
      );
    }
    const streaming = getStreamingProxy();
    return wrapWriter(handleId, streaming);
  } catch (e) {
    throw wrapError(e, path);
  }
}
