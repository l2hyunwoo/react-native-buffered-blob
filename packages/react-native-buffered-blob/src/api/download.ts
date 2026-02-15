import { NativeModule, getStreamingProxy } from '../module';
import { wrapError } from '../errors';
import type { DownloadProgress } from '../types';

export interface DownloadOptions {
  url: string;
  destPath: string;
  headers?: Record<string, string>;
  onProgress?: (progress: DownloadProgress) => void;
}

export interface DownloadHandle {
  promise: Promise<void>;
  cancel: () => void;
}

export function download(options: DownloadOptions): DownloadHandle {
  const { url, destPath, headers = {}, onProgress } = options;

  try {
    const handleId = NativeModule.createDownload(url, destPath, headers);
    const streaming = getStreamingProxy();

    const progressCallback = onProgress
      ? (bytesDownloaded: number, totalBytes: number, progress: number) => {
          onProgress({ bytesDownloaded, totalBytes, progress });
        }
      : (_b: number, _t: number, _p: number) => {};

    const promise = (async () => {
      try {
        await streaming.startDownload(handleId, progressCallback);
      } finally {
        NativeModule.closeHandle(handleId);
      }
    })();

    const cancel = () => {
      streaming.cancelDownload(handleId);
    };

    return { promise, cancel };
  } catch (e) {
    throw wrapError(e, destPath);
  }
}
