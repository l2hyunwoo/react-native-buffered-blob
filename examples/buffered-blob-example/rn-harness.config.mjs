import { androidPlatform } from '@react-native-harness/platform-android';
import {
  applePlatform,
  appleSimulator,
} from '@react-native-harness/platform-apple';

export default {
  entryPoint: './index.js',
  appRegistryComponentName: 'BufferedBlobExample',

  runners: [
    androidPlatform({
      name: 'android',
      device: { type: 'physical', manufacturer: 'samsung', model: 'SM-S926N' },
      bundleId: 'com.bufferedblobexample',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator('iPhone 17 Pro', '26.2'),
      bundleId: 'com.bufferedblobexample',
    }),
  ],
  defaultRunner: 'ios',
};
