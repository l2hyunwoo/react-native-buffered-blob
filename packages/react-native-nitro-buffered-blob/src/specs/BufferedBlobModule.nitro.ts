import type { HybridObject } from 'react-native-nitro-modules';
import type { NativeFileReader } from './NativeFileReader.nitro';
import type { NativeFileWriter } from './NativeFileWriter.nitro';
import type { NativeDownloader } from './NativeDownloader.nitro';
import type { FileInfo, HashAlgorithm } from './types.nitro';

export interface BufferedBlobModule
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  // Stream Factories (sync - file handle creation is sub-ms)
  openRead(path: string, bufferSize: number): NativeFileReader;
  openWrite(path: string, append: boolean): NativeFileWriter;
  createDownload(
    url: string,
    destPath: string,
    headers: Record<string, string>
  ): NativeDownloader;

  // File System Operations
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<FileInfo>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  ls(path: string): Promise<FileInfo[]>;
  cp(srcPath: string, destPath: string): Promise<void>;
  mv(srcPath: string, destPath: string): Promise<void>;

  // Hashing
  hashFile(path: string, algorithm: HashAlgorithm): Promise<string>;

  // Directory Paths
  readonly documentDir: string;
  readonly cacheDir: string;
  readonly tempDir: string;
  readonly downloadDir: string;
}
