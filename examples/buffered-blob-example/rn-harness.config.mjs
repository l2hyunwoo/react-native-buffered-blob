import {
  androidPlatform,
  androidEmulator,
} from '@react-native-harness/platform-android';
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
      device: androidEmulator('Pixel_8_API_35'),
      bundleId: 'com.bufferedblobexample',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator('iPhone 16 Pro', '18.0'),
      bundleId: 'com.bufferedblobexample',
    }),
  ],
  defaultRunner: 'ios',
};
