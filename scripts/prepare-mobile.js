const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'mobile', 'www');

function rimraf(dir) {
    if (!fs.existsSync(dir)) return;
    fs.rmSync(dir, { recursive: true, force: true });
}

function copyFile(src, dest) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const from = path.join(src, entry.name);
        const to = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(from, to);
        else copyFile(from, to);
    }
}

function prepareHtml(fileName, scriptName) {
    const src = path.join(root, 'html', fileName);
    let html = fs.readFileSync(src, 'utf-8');
    html = html.replaceAll('../assets/', './assets/');
    html = html.replace(
        `src="../${scriptName}"`,
        `src="./bridge.js"></script>\n<script src="./${scriptName}"`
    );
    html = html.replace(
        /content="default-src 'self'; script-src 'self'; media-src 'self' pills-sound:; style-src 'self' 'unsafe-inline'"/g,
        `content="default-src 'self' data: blob: capacitor: https:; script-src 'self'; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' capacitor: https:"`
    );
    fs.writeFileSync(path.join(outDir, fileName), html);
}

rimraf(outDir);
fs.mkdirSync(outDir, { recursive: true });

copyDir(path.join(root, 'assets'), path.join(outDir, 'assets'));
copyFile(path.join(root, 'renderer.js'), path.join(outDir, 'renderer.js'));
copyFile(path.join(root, 'alarm-renderer.js'), path.join(outDir, 'alarm-renderer.js'));
copyFile(path.join(root, 'mobile', 'bridge.js'), path.join(outDir, 'bridge.js'));

prepareHtml('index.html', 'renderer.js');
prepareHtml('alarm.html', 'alarm-renderer.js');

console.log('mobile www prepared at', outDir);
