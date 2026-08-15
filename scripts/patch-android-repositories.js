/**
 * Prefer Google's Maven Central mirror so GitHub Actions runners
 * are less likely to hit 403 Forbidden from repo.maven.apache.org.
 * Run after `cap add` / `cap sync` (android/ is generated).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MIRROR_URL = 'https://maven-central.storage-download.googleapis.com/maven2/';
const MIRROR_LINE = `maven { url '${MIRROR_URL}' }`;
const MARKER = 'maven-central.storage-download.googleapis.com';

const TARGETS = [
    path.join(ROOT, 'android', 'build.gradle'),
    path.join(ROOT, 'android', 'settings.gradle'),
    path.join(ROOT, 'android', 'app', 'build.gradle'),
    path.join(ROOT, 'plugins', 'alarm-overlay', 'android', 'build.gradle'),
];

function collectGradleFiles(dir, out = []) {
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, name.name);
        if (name.isDirectory()) {
            if (name.name === 'build' || name.name === '.gradle') continue;
            collectGradleFiles(full, out);
        } else if (name.name.endsWith('.gradle') || name.name.endsWith('.gradle.kts')) {
            out.push(full);
        }
    }
    return out;
}

function patchText(text) {
    if (text.includes(MARKER)) return { text, changed: false };

    let next = text.replace(
        /^([ \t]*)mavenCentral\(\)/gm,
        (_, indent) => `${indent}${MIRROR_LINE}\n${indent}mavenCentral()`
    );

    if (next === text && /repositories\s*\{/.test(text)) {
        next = text.replace(/repositories\s*\{/, (block) => `${block}\n        ${MIRROR_LINE}`);
    }

    return { text: next, changed: next !== text };
}

function patchFile(file) {
    if (!fs.existsSync(file)) return false;
    const original = fs.readFileSync(file, 'utf8');
    const { text, changed } = patchText(original);
    if (!changed) return false;
    fs.writeFileSync(file, text);
    console.log(`[android-repos] patched ${path.relative(ROOT, file)}`);
    return true;
}

const files = new Set([
    ...TARGETS,
    ...collectGradleFiles(path.join(ROOT, 'android')),
]);

let count = 0;
for (const file of files) {
    if (patchFile(file)) count += 1;
}

// Soften transient CDN failures
const propsPath = path.join(ROOT, 'android', 'gradle.properties');
if (fs.existsSync(propsPath)) {
    let props = fs.readFileSync(propsPath, 'utf8');
    const extras = [
        'systemProp.org.gradle.internal.http.connectionTimeout=120000',
        'systemProp.org.gradle.internal.http.socketTimeout=120000',
        'systemProp.org.gradle.internal.repository.max.retries=5',
        'systemProp.org.gradle.internal.repository.initial.backoff=2000',
    ];
    let propsChanged = false;
    for (const line of extras) {
        const key = line.split('=')[0];
        if (!props.includes(key)) {
            props += `\n${line}`;
            propsChanged = true;
        }
    }
    if (propsChanged) {
        fs.writeFileSync(propsPath, `${props.trimEnd()}\n`);
        console.log('[android-repos] updated android/gradle.properties timeouts/retries');
        count += 1;
    }
}

console.log(`[android-repos] done (${count} file(s) updated)`);
