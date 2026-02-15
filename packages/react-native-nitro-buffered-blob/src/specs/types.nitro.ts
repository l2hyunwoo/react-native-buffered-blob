import type { Int64 } from 'react-native-nitro-modules';

export enum HashAlgorithm {
  SHA256,
  MD5,
}

export enum FileType {
  FILE,
  DIRECTORY,
  UNKNOWN,
}

export interface FileInfo {
  path: string;
  name: string;
  size: Int64;
  type: FileType;
  lastModified: number;
}

export interface DownloadProgress {
  bytesDownloaded: Int64;
  totalBytes: Int64;
  progress: number;
}
