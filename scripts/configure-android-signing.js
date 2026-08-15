#!/usr/bin/env node
/**
 * Configure a stable signing key for Android so APK updates install over previous builds.
 * Capacitor creates a fresh debug keystore on each CI runner — that breaks in-app updates.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gradlePath = path.join(root, 'android', 'app', 'build.gradle');
const propsPath = path.join(root, 'android-signing', 'keystore.properties');
const storePath = path.join(root, 'android-signing', 'pillsnative.keystore');

if (!fs.existsSync(gradlePath)) {
    console.log('android/app/build.gradle not found — skip signing config');
    process.exit(0);
}
if (!fs.existsSync(propsPath) || !fs.existsSync(storePath)) {
    console.error('Missing android-signing/pillsnative.keystore or keystore.properties');
    process.exit(1);
}

const props = Object.fromEntries(
    fs.readFileSync(propsPath, 'utf-8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
            const i = line.indexOf('=');
            return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
        }),
);

let gradle = fs.readFileSync(gradlePath, 'utf-8');

if (gradle.includes('pillsnativeSigning')) {
    console.log('Android signing already configured');
    process.exit(0);
}

const signingBlock = `
    signingConfigs {
        pillsnativeSigning {
            storeFile file("../../android-signing/${props.storeFile || 'pillsnative.keystore'}")
            storePassword "${props.storePassword}"
            keyAlias "${props.keyAlias}"
            keyPassword "${props.keyPassword}"
            storeType "${props.storeType || 'PKCS12'}"
        }
    }
`;

// Insert signingConfigs before buildTypes (or before closing of android {).
if (/buildTypes\s*\{/.test(gradle)) {
    gradle = gradle.replace(/(\n\s*)(buildTypes\s*\{)/, `$1${signingBlock.trim()}\n$1$2`);
} else {
    gradle = gradle.replace(/android\s*\{/, (match) => `${match}\n${signingBlock}`);
}

gradle = gradle.replace(
    /buildTypes\s*\{([\s\S]*?)\n(\s*)\}/,
    (full, body, indent) => {
        let next = body;
        if (/release\s*\{/.test(next)) {
            next = next.replace(/release\s*\{/, (m) => `${m}\n${indent}    signingConfig signingConfigs.pillsnativeSigning`);
        } else {
            next += `\n${indent}release {\n${indent}    signingConfig signingConfigs.pillsnativeSigning\n${indent}}\n`;
        }
        if (/debug\s*\{/.test(next)) {
            next = next.replace(/debug\s*\{/, (m) => `${m}\n${indent}    signingConfig signingConfigs.pillsnativeSigning`);
        } else {
            next += `\n${indent}debug {\n${indent}    signingConfig signingConfigs.pillsnativeSigning\n${indent}}\n`;
        }
        return `buildTypes {${next}\n${indent}}`;
    },
);

fs.writeFileSync(gradlePath, gradle);
console.log('Configured stable Android signing (pillsnative keystore)');
