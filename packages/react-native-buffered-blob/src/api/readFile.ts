import { NativeModule, getStreamingProxy } from '../module';
import { wrapError } from '../errors';
import { wrapReader } from '../types';
import type { BlobReader } from '../types';

const DEFAULT_BUFFER_SIZE = 65536; // 64KB

export function createReader(
  path: string,
  bufferSize: number = DEFAULT_BUFFER_SIZE
): BlobReader {
  try {
    const handleId = NativeModule.openRead(path, bufferSize);
    const streaming = getStreamingProxy();
    return wrapReader(handleId, streaming);
  } catch (e) {
    throw wrapError(e);
  }
}
