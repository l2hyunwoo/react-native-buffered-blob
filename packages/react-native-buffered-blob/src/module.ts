import NativeModule from './NativeBufferedBlob';

// Install JSI HostObject on first import
const installed = NativeModule.install();
if (!installed) {
  throw new Error(
    '[BufferedBlob] Failed to install JSI streaming bridge. Ensure the native module is linked.'
  );
}

export interface StreamingProxy {
  readNextChunk(handleId: number): Promise<ArrayBuffer | null>;
  write(handleId: number, data: ArrayBuffer): Promise<number>;
  flush(handleId: number): Promise<void>;
  close(handleId: number): void;
  startDownload(
    handleId: number,
    onProgress: (
      bytesDownloaded: number,
      totalBytes: number,
      progress: number
    ) => void
  ): Promise<void>;
  cancelDownload(handleId: number): void;
  getReaderInfo(handleId: number): {
    fileSize: number;
    bytesRead: number;
    isEOF: boolean;
  };
  getWriterInfo(handleId: number): { bytesWritten: number };
}

declare global {
  var __BufferedBlobStreaming: StreamingProxy | undefined;
}

// Access the JSI HostObject installed by native
function getStreamingProxy(): StreamingProxy {
  const proxy = globalThis.__BufferedBlobStreaming;
  if (!proxy) {
    throw new Error(
      '[BufferedBlob] Streaming proxy not available. Make sure install() was called.'
    );
  }
  return proxy as StreamingProxy;
}

export { NativeModule, getStreamingProxy };
