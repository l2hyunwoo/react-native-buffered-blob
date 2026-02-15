import type { HybridObject, Int64 } from 'react-native-nitro-modules';

export interface NativeFileReader
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  readNextChunk(): Promise<ArrayBuffer | undefined>;
  readonly fileSize: Int64;
  readonly bytesRead: Int64;
  readonly isEOF: boolean;
  close(): void;
}
