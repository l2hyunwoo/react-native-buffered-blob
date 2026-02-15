const path = require('path');
const pkg = require('react-native-nitro-buffered-blob/package.json');

module.exports = {
  project: {
    ios: {
      automaticPodsInstallation: true,
    },
  },
  dependencies: {
    [pkg.name]: {
      root: path.join(
        __dirname,
        '..',
        '..',
        'packages',
        'react-native-nitro-buffered-blob'
      ),
      platforms: {
        // Codegen script incorrectly fails without this
        // So we explicitly specify the platforms with empty object
        ios: {},
        android: {},
      },
    },
  },
};
