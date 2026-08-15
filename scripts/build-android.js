#!/usr/bin/env node
/**
 * Local debug APK build: prepare web → Capacitor Android → assembleDebug.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const androidDir = path.join(root, 'android');
const isWin = process.platform === 'win32';

function run(command, args, cwd = root) {
    const result = spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        shell: isWin,
    });
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

function npx(args) {
    run(isWin ? 'npx.cmd' : 'npx', args);
}

npx(['node', 'scripts/prepare-mobile.js']);

if (!fs.existsSync(path.join(androidDir, 'app'))) {
    npx(['cap', 'add', 'android']);
}

npx(['cap', 'sync', 'android']);
npx(['node', 'scripts/patch-android-manifest.js']);
npx(['node', 'scripts/sync-android-version.js']);
npx(['node', 'scripts/sync-android-icons.js']);
npx(['node', 'scripts/configure-android-signing.js']);
npx(['node', 'scripts/patch-android-repositories.js']);

const gradlew = path.join(androidDir, isWin ? 'gradlew.bat' : 'gradlew');
if (!isWin && fs.existsSync(gradlew)) {
    try { fs.chmodSync(gradlew, 0o755); } catch { /* ignore */ }
}
const initScript = path.join(root, 'scripts', 'gradle-maven-mirrors.init.gradle');
run(gradlew, ['assembleDebug', '--no-daemon', `--init-script=${initScript}`], androidDir);

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const src = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!fs.existsSync(src)) {
    console.error('APK not found:', src);
    process.exit(1);
}

const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const dest = path.join(outDir, `PillsNative-android-${pkg.version}.apk`);
fs.copyFileSync(src, dest);
console.log('APK:', dest);
