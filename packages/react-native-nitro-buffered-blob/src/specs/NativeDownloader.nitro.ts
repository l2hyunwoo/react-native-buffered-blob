import type { HybridObject } from 'react-native-nitro-modules';
import type { DownloadProgress } from './types.nitro';

export interface NativeDownloader
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  start(onProgress: (progress: DownloadProgress) => void): Promise<void>;
  cancel(): void;
  readonly isCancelled: boolean;
}
