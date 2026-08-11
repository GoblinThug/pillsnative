const fs = require('fs');
const path = require('path');

const sampleRate = 44100;
const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

function writeWav(file, samples) {
    const data = Buffer.alloc(samples.length * 2);
    for (let i = 0; i < samples.length; i += 1) {
        const clipped = Math.max(-1, Math.min(1, samples[i]));
        data.writeInt16LE((clipped * 32767) | 0, i * 2);
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + data.length, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(outDir, file), Buffer.concat([header, data]));
    console.log('wrote', file);
}

function bell(t, freq, start, len, amp, brightness = 1) {
    const x = t - start;
    if (x < 0 || x > len) return 0;
    const attack = Math.min(1, x / 0.012);
    const decay = Math.exp(-x * (2.4 + brightness * 0.5));
    const env = attack * decay;
    return amp * env * (
        Math.sin(2 * Math.PI * freq * x) * 0.62
        + Math.sin(2 * Math.PI * freq * 2.002 * x) * 0.18 * Math.exp(-x * 4) * brightness
        + Math.sin(2 * Math.PI * freq * 2.76 * x) * 0.08 * Math.exp(-x * 6) * brightness
        + Math.sin(2 * Math.PI * freq * 4.07 * x) * 0.04 * Math.exp(-x * 8) * brightness
    );
}

function wood(t, freq, start, len, amp) {
    const x = t - start;
    if (x < 0 || x > len) return 0;
    const env = Math.min(1, x / 0.008) * Math.exp(-x * 5.2);
    const noise = (Math.random() * 2 - 1) * Math.exp(-x * 45) * 0.07;
    return amp * env * (Math.sin(2 * Math.PI * freq * x) * 0.85 + noise);
}

function softPad(t, freq, start, len, amp) {
    const x = t - start;
    if (x < 0 || x > len) return 0;
    const attack = Math.min(1, x / 0.05);
    const release = Math.max(0, 1 - Math.max(0, x - (len - 0.25)) / 0.25);
    const env = attack * release;
    return amp * env * (
        Math.sin(2 * Math.PI * freq * x) * 0.55
        + Math.sin(2 * Math.PI * freq * 2 * x) * 0.2 * Math.exp(-x * 3)
    );
}

function renderLoop(phraseSec, gapSec, renderPhrase) {
    const duration = phraseSec + gapSec;
    const numSamples = Math.floor(sampleRate * duration);
    const samples = new Float64Array(numSamples);
    for (let i = 0; i < numSamples; i += 1) {
        const t = i / sampleRate;
        if (t <= phraseSec) samples[i] = renderPhrase(t);
    }
    let peak = 0;
    for (let i = 0; i < samples.length; i += 1) peak = Math.max(peak, Math.abs(samples[i]));
    const gain = peak > 0 ? 0.7 / peak : 1;
    return Float64Array.from(samples, (v) => v * gain);
}

const sounds = {
    'soft-marimba.wav': () => renderLoop(2.2, 2.8, (t) => (
        bell(t, 523.25, 0.00, 1.4, 0.34, 0.9)
        + bell(t, 659.25, 0.28, 1.4, 0.30, 0.85)
        + bell(t, 783.99, 0.56, 1.5, 0.26, 0.8)
        + bell(t, 1046.5, 0.92, 1.6, 0.20, 0.75)
    )),
    'soft-glass.wav': () => renderLoop(2.0, 2.8, (t) => (
        bell(t, 880.00, 0.00, 1.3, 0.24, 1.2)
        + bell(t, 1174.7, 0.24, 1.3, 0.20, 1.15)
        + bell(t, 1396.9, 0.50, 1.4, 0.16, 1.1)
        + bell(t, 1760.0, 0.80, 1.4, 0.12, 1.0)
    )),
    'soft-wood.wav': () => renderLoop(2.1, 2.9, (t) => (
        wood(t, 392.00, 0.00, 0.9, 0.34)
        + wood(t, 493.88, 0.32, 0.9, 0.30)
        + wood(t, 587.33, 0.64, 1.0, 0.26)
        + wood(t, 659.25, 1.00, 1.0, 0.22)
    )),
    'soft-chime.wav': () => renderLoop(2.3, 2.7, (t) => (
        bell(t, 659.25, 0.00, 1.5, 0.28, 0.85)
        + bell(t, 830.61, 0.35, 1.5, 0.24, 0.8)
        + bell(t, 987.77, 0.70, 1.6, 0.20, 0.75)
        + bell(t, 1318.5, 1.10, 1.6, 0.16, 0.7)
    )),
    'soft-piano.wav': () => renderLoop(2.4, 2.8, (t) => (
        softPad(t, 261.63, 0.00, 1.0, 0.30)
        + softPad(t, 329.63, 0.28, 1.0, 0.26)
        + softPad(t, 392.00, 0.56, 1.1, 0.24)
        + softPad(t, 523.25, 0.95, 1.2, 0.20)
    )),
    'soft-harp.wav': () => renderLoop(2.2, 2.8, (t) => (
        bell(t, 392.00, 0.00, 1.2, 0.26, 0.75)
        + bell(t, 493.88, 0.18, 1.2, 0.24, 0.7)
        + bell(t, 587.33, 0.36, 1.2, 0.22, 0.7)
        + bell(t, 740.00, 0.54, 1.3, 0.18, 0.65)
        + bell(t, 880.00, 0.76, 1.4, 0.14, 0.6)
    )),
    'soft-kalimba.wav': () => renderLoop(2.0, 2.9, (t) => (
        wood(t, 523.25, 0.00, 0.8, 0.32)
        + wood(t, 659.25, 0.26, 0.8, 0.28)
        + wood(t, 783.99, 0.52, 0.9, 0.26)
        + wood(t, 659.25, 0.84, 0.9, 0.24)
    )),
    'soft-temple.wav': () => renderLoop(2.4, 3.0, (t) => (
        bell(t, 440.00, 0.00, 1.7, 0.32, 0.5)
        + bell(t, 554.37, 0.55, 1.7, 0.24, 0.45)
        + bell(t, 659.25, 1.15, 1.8, 0.18, 0.4)
    )),
    'soft-crystal.wav': () => renderLoop(2.1, 2.8, (t) => (
        bell(t, 698.46, 0.00, 1.3, 0.22, 1.2)
        + bell(t, 880.00, 0.28, 1.3, 0.20, 1.15)
        + bell(t, 1046.5, 0.56, 1.4, 0.16, 1.1)
        + bell(t, 1318.5, 0.90, 1.4, 0.12, 1.0)
    )),
    'soft-lullaby.wav': () => renderLoop(2.6, 2.9, (t) => (
        softPad(t, 293.66, 0.00, 1.0, 0.28)
        + softPad(t, 349.23, 0.45, 1.0, 0.24)
        + softPad(t, 440.00, 0.95, 1.1, 0.22)
        + softPad(t, 349.23, 1.50, 1.0, 0.20)
    )),
    'soft-drop.wav': () => renderLoop(1.8, 2.9, (t) => (
        bell(t, 987.77, 0.00, 0.8, 0.22, 1.1)
        + bell(t, 1174.7, 0.40, 0.8, 0.18, 1.05)
        + bell(t, 1318.5, 0.85, 0.9, 0.14, 1.0)
    )),
    'soft-breeze.wav': () => renderLoop(2.5, 2.9, (t) => (
        softPad(t, 196.00, 0.00, 1.8, 0.16)
        + softPad(t, 246.94, 0.15, 1.8, 0.14)
        + softPad(t, 293.66, 0.35, 1.8, 0.12)
        + bell(t, 587.33, 0.70, 1.2, 0.12, 0.55)
        + bell(t, 740.00, 1.20, 1.2, 0.10, 0.5)
    )),
};

for (const [file, build] of Object.entries(sounds)) {
    writeWav(file, build());
}

const marimba = sounds['soft-marimba.wav']();
writeWav('alarm.wav', marimba);
writeWav('notify-soft.wav', marimba);
console.log('done');
