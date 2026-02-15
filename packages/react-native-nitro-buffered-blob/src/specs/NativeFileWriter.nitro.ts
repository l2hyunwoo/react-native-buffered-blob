import type { HybridObject, Int64 } from 'react-native-nitro-modules';

export interface NativeFileWriter
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  write(data: ArrayBuffer): Promise<Int64>;
  flush(): Promise<void>;
  readonly bytesWritten: Int64;
  close(): void;
}
