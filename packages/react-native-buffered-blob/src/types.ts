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

export interface BlobReader extends Disposable {
  readonly handleId: number;
  readonly fileSize: number;
  readonly bytesRead: number;
  readonly isEOF: boolean;
  readNextChunk(): Promise<ArrayBuffer | null>;
  close(): void;
}

export interface BlobWriter extends Disposable {
  readonly handleId: number;
  readonly bytesWritten: number;
  write(data: ArrayBuffer): Promise<number>;
  flush(): Promise<void>;
  close(): void;
}
