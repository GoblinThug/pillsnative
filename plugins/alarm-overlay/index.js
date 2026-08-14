'use strict';

let AlarmOverlay;

try {
    const { registerPlugin } = require('@capacitor/core');
    AlarmOverlay = registerPlugin('AlarmOverlay');
} catch {
    AlarmOverlay = {
        scheduleAll: async () => ({}),
        startBackground: async () => ({}),
        getStatus: async () => ({
            platform: 'web',
            overlay: false,
            notifications: false,
            exactAlarms: false,
            background: false,
        }),
        requestPermission: async () => ({}),
    };
}

module.exports = { AlarmOverlay };
