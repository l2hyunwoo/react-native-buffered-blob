import { NativeModule, getStreamingProxy } from '../module';
import { wrapError } from '../errors';
import { wrapWriter } from '../types';
import type { BlobWriter } from '../types';

export function createWriter(
  path: string,
  append: boolean = false
): BlobWriter {
  try {
    const handleId = NativeModule.openWrite(path, append);
    const streaming = getStreamingProxy();
    return wrapWriter(handleId, streaming);
  } catch (e) {
    throw wrapError(e);
  }
}
