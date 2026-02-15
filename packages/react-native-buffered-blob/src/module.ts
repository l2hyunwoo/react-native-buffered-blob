import { TurboModuleRegistry } from 'react-native';
import type { Spec } from './NativeBufferedBlob';

const NativeModule = TurboModuleRegistry.getEnforcing<Spec>('BufferedBlob');

// Install JSI HostObject on first import
NativeModule.install();

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

// Access the JSI HostObject installed by native
function getStreamingProxy(): StreamingProxy {
  const proxy = (global as any).__BufferedBlobStreaming;
  if (!proxy) {
    throw new Error(
      '[BufferedBlob] Streaming proxy not available. Make sure install() was called.'
    );
  }
  return proxy as StreamingProxy;
}

export { NativeModule, getStreamingProxy };
