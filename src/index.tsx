import { NitroModules } from 'react-native-nitro-modules';
import type { NitroBlob } from './NitroBlob.nitro';

const NitroBlobHybridObject =
  NitroModules.createHybridObject<NitroBlob>('NitroBlob');

export function multiply(a: number, b: number): number {
  return NitroBlobHybridObject.multiply(a, b);
}
