'use strict';

let AlarmOverlay;

try {
    const { registerPlugin } = require('@capacitor/core');
    AlarmOverlay = registerPlugin('AlarmOverlay');
} catch {
    AlarmOverlay = {
        scheduleAll: async () => ({}),
        startBackground: async () => ({}),
        minimizeApp: async () => {},
        pickCustomSound: async () => ({ canceled: true }),
        removeCustomSoundFile: async () => {},
        getStatus: async () => ({
            platform: 'web',
            overlay: false,
            notifications: false,
            exactAlarms: false,
            background: false,
            fullScreenIntent: false,
            installPackages: false,
        }),
        requestPermission: async () => ({}),
        getAppVersion: async () => ({ version: 'web' }),
        checkForUpdates: async () => ({ state: 'unsupported' }),
        downloadUpdate: async () => ({ state: 'unsupported' }),
        installUpdate: async () => ({ state: 'unsupported' }),
        openReleases: async () => {},
        addListener: async () => ({ remove: () => {} }),
    };
}

module.exports = { AlarmOverlay };
