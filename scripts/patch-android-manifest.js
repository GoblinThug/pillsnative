#!/usr/bin/env node
/**
 * After `cap add/sync android`, ensure exact-alarm + boot permissions
 * so reminders fire when the app is force-stopped / device rebooted.
 */
const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifestPath)) {
    console.log('AndroidManifest.xml not found — skip (run after cap add android)');
    process.exit(0);
}

let xml = fs.readFileSync(manifestPath, 'utf-8');
const permissions = [
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.SCHEDULE_EXACT_ALARM',
    'android.permission.USE_EXACT_ALARM',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.VIBRATE',
    'android.permission.WAKE_LOCK',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.USE_FULL_SCREEN_INTENT',
];

let changed = false;
for (const permission of permissions) {
    if (xml.includes(permission)) continue;
    xml = xml.replace(
        '<application',
        `    <uses-permission android:name="${permission}" />\n    <application`,
    );
    changed = true;
}

if (changed) {
    fs.writeFileSync(manifestPath, xml);
    console.log('Patched AndroidManifest.xml with notification permissions');
} else {
    console.log('AndroidManifest.xml already has notification permissions');
}
