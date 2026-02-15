import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  // Called once to install JSI HostObject on global.__BufferedBlobStreaming
  install(): boolean;

  // --- Stream Handle Factories ---
  // Return numeric handle IDs that reference native objects in an internal registry.
  // The handle IDs are passed to the JSI HostObject for streaming operations.
  openRead(path: string, bufferSize: number): number;
  openWrite(path: string, append: boolean): number;
  createDownload(url: string, destPath: string, headers: Object): number;

  // --- Handle Cleanup ---
  // Close a handle by ID. Safe to call multiple times.
  closeHandle(handleId: number): void;

  // --- File System Operations ---
  exists(path: string): Promise<boolean>;
  stat(path: string): Promise<{
    path: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }>;
  unlink(path: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  ls(path: string): Promise<
    Array<{
      path: string;
      name: string;
      size: number;
      type: string;
      lastModified: number;
    }>
  >;
  cp(srcPath: string, destPath: string): Promise<void>;
  mv(srcPath: string, destPath: string): Promise<void>;

  // --- Hashing ---
  hashFile(path: string, algorithm: string): Promise<string>;

  // --- Constants ---
  getConstants(): {
    documentDir: string;
    cacheDir: string;
    tempDir: string;
    downloadDir: string;
  };
}

export default TurboModuleRegistry.getEnforcing<Spec>('BufferedBlob');
