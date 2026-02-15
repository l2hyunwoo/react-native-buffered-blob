import type { StreamingProxy } from './module';

// NOTE: Enums changed from numeric (Nitro) to string (Turbo Module compatibility)
export enum HashAlgorithm {
  SHA256 = 'sha256',
  MD5 = 'md5',
}

export enum FileType {
  FILE = 'file',
  DIRECTORY = 'directory',
  UNKNOWN = 'unknown',
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: FileType;
  lastModified: number;
}

export interface DownloadProgress {
  bytesDownloaded: number;
  totalBytes: number;
  progress: number;
}

export interface BlobReader {
  readonly handleId: number;
  readonly fileSize: number;
  readonly bytesRead: number;
  readonly isEOF: boolean;
  readNextChunk(): Promise<ArrayBuffer | null>;
  close(): void;
}

export interface BlobWriter {
  readonly handleId: number;
  readonly bytesWritten: number;
  write(data: ArrayBuffer): Promise<number>;
  flush(): Promise<void>;
  close(): void;
}

/**
 * Wraps a native reader handle with explicit getter delegation.
 * IMPORTANT: Does NOT use spread operator on HostObject (getters would be lost).
 * Instead, proxies each property access through getReaderInfo().
 */
export function wrapReader(
  handleId: number,
  streaming: StreamingProxy
): BlobReader {
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
      return streaming.readNextChunk(handleId);
    },
    close() {
      streaming.close(handleId);
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
  return {
    get handleId() {
      return handleId;
    },
    get bytesWritten() {
      return streaming.getWriterInfo(handleId).bytesWritten;
    },
    write(data: ArrayBuffer) {
      return streaming.write(handleId, data);
    },
    flush() {
      return streaming.flush(handleId);
    },
    close() {
      streaming.close(handleId);
    },
  };
}
