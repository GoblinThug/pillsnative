#!/usr/bin/env node
/**
 * Copy launcher icons into Capacitor android/ after `cap add/sync`.
 * Source: assets/android-icons (generated from assets/img/icon.png).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const srcRoot = path.join(root, 'assets', 'android-icons');
const resRoot = path.join(root, 'android', 'app', 'src', 'main', 'res');

if (!fs.existsSync(srcRoot)) {
    console.error('Missing assets/android-icons — cannot sync Android icons');
    process.exit(1);
}
if (!fs.existsSync(resRoot)) {
    console.log('android/app/src/main/res not found — skip icon sync');
    process.exit(0);
}

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const src = path.join(from, entry.name);
        const dest = path.join(to, entry.name);
        if (entry.isDirectory()) copyDir(src, dest);
        else fs.copyFileSync(src, dest);
    }
}

for (const entry of fs.readdirSync(srcRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    // Skip values/ — color is patched below to avoid duplicate resources.
    if (entry.name === 'values') continue;
    copyDir(path.join(srcRoot, entry.name), path.join(resRoot, entry.name));
}

// Remove default Capacitor webp launchers if present (PNG takes over same name).
const densities = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
const names = ['ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp'];
for (const density of densities) {
    for (const name of names) {
        const file = path.join(resRoot, density, name);
        if (fs.existsSync(file)) fs.unlinkSync(file);
    }
}

const colorsPath = path.join(resRoot, 'values', 'colors.xml');
const bgColor = '#000000';
if (fs.existsSync(colorsPath)) {
    let colors = fs.readFileSync(colorsPath, 'utf-8');
    if (/name="ic_launcher_background"/.test(colors)) {
        colors = colors.replace(
            /<color name="ic_launcher_background">[^<]*<\/color>/,
            `<color name="ic_launcher_background">${bgColor}</color>`,
        );
    } else {
        colors = colors.replace(
            '</resources>',
            `    <color name="ic_launcher_background">${bgColor}</color>\n</resources>`,
        );
    }
    fs.writeFileSync(colorsPath, colors);
} else {
    fs.mkdirSync(path.dirname(colorsPath), { recursive: true });
    fs.writeFileSync(
        colorsPath,
        `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bgColor}</color>\n</resources>\n`,
    );
}

console.log('Synced Android launcher icons from assets/android-icons');
