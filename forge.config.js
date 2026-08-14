const path = require('path');
const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

const ignorePatterns = [
  /^\/\.git($|\/)/,
  /^\/\.github($|\/)/,
  /^\/\.idea($|\/)/,
  /^\/out($|\/)/,
  /^\/mobile($|\/)/,
  /^\/plugins($|\/)/,
  /^\/android($|\/)/,
  /^\/ios($|\/)/,
  /^\/scripts($|\/)/,
  /^\/node_modules\/@tailwindcss($|\/)/,
  /^\/node_modules\/tailwindcss($|\/)/,
  /^\/node_modules\/@parcel($|\/)/,
  /^\/node_modules\/@capacitor($|\/)/,
  /^\/capacitor\.config\.json$/,
  /^\/README\.md$/,
];

module.exports = {
  packagerConfig: {
    asar: true,
    icon: path.join(__dirname, 'assets', 'img', 'icon'),
    appBundleId: 'com.goblinthug.pillsnative',
    executableName: 'pillsnative',
    // App uses prebuilt CSS — no native Tailwind/@parcel modules at runtime.
    ignore: (file) => ignorePatterns.some((pattern) => pattern.test(file)),
  },
  // No native addons required by the app; skip node-gyp rebuild in CI.
  rebuildConfig: {
    onlyModules: [],
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'pillsnative',
        setupIcon: path.join(__dirname, 'assets', 'img', 'icon.ico'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        icon: path.join(__dirname, 'assets', 'img', 'icon.png'),
        name: 'PillsNative',
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Goblin_Thug',
          homepage: 'https://github.com/GoblinThug/pillsnative',
        },
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'GoblinThug',
          name: 'pillsnative',
        },
        draft: false,
        generateReleaseNotes: true,
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
