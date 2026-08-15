#!/usr/bin/env node
/**
 * Keep Android versionName/versionCode in sync with package.json so
 * in-app APK updates from GitHub Releases can install over the previous build.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const versionName = String(pkg.version || '1.0.0').split('-')[0];
const parts = versionName.split('.').map((part) => parseInt(part, 10) || 0);
const versionCode = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);

const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) {
    console.log('android/app/build.gradle not found — skip version sync');
    process.exit(0);
}

let gradle = fs.readFileSync(gradlePath, 'utf-8');
const next = gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);

if (next === gradle) {
    console.log(`Android version already ${versionName} (${versionCode})`);
} else {
    fs.writeFileSync(gradlePath, next);
    console.log(`Synced Android version → ${versionName} (code ${versionCode})`);
}
