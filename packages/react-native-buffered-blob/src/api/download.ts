import { NativeModule, getStreamingProxy } from '../module';
import { wrapError } from '../errors';
import type { DownloadProgress } from '../types';

export interface DownloadOptions {
  url: string;
  destPath: string;
  headers?: Record<string, string>;
  onProgress?: (progress: DownloadProgress) => void;
}

export async function download(options: DownloadOptions): Promise<void> {
  const { url, destPath, headers = {}, onProgress } = options;

  try {
    const handleId = NativeModule.createDownload(url, destPath, headers);
    const streaming = getStreamingProxy();

    const progressCallback = onProgress
      ? (bytesDownloaded: number, totalBytes: number, progress: number) => {
          onProgress({ bytesDownloaded, totalBytes, progress });
        }
      : (_b: number, _t: number, _p: number) => {};

    try {
      await streaming.startDownload(handleId, progressCallback);
    } finally {
      NativeModule.closeHandle(handleId);
    }
  } catch (e) {
    throw wrapError(e, destPath);
  }
}
