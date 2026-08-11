const { app, BrowserWindow, Notification, ipcMain, Tray, Menu, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'pills-sound',
        privileges: {
            standard: true,
            supportFetchAPI: true,
            stream: true,
            bypassCSP: true,
            corsEnabled: true,
        },
    },
]);

app.setName('Pills Native');
app.setAppUserModelId('Pills Native');

let mainWindow = null;
let alarmWindow = null;
let activeNotification = null;
let tray = null;
const jobsByPillId = new Map();
const dataFilePath = () => path.join(app.getPath('documents'), 'pills.json');
const settingsFilePath = () => path.join(app.getPath('documents'), 'pills-settings.json');
const customSoundsDir = () => path.join(app.getPath('documents'), 'pills-custom-sounds');

const SOUND_OPTIONS = [
    { id: 'soft-marimba', name: 'Мягкая маримба', file: 'soft-marimba.wav' },
    { id: 'soft-glass', name: 'Стеклянные колокольчики', file: 'soft-glass.wav' },
    { id: 'soft-wood', name: 'Спокойный тон', file: 'soft-wood.wav' },
    { id: 'soft-chime', name: 'Мягкий chime', file: 'soft-chime.wav' },
    { id: 'soft-piano', name: 'Тихое пианино', file: 'soft-piano.wav' },
    { id: 'soft-harp', name: 'Арфа', file: 'soft-harp.wav' },
    { id: 'soft-kalimba', name: 'Калимба', file: 'soft-kalimba.wav' },
    { id: 'soft-temple', name: 'Храмовый колокол', file: 'soft-temple.wav' },
    { id: 'soft-crystal', name: 'Кристалл', file: 'soft-crystal.wav' },
    { id: 'soft-lullaby', name: 'Колыбельная', file: 'soft-lullaby.wav' },
    { id: 'soft-drop', name: 'Капли', file: 'soft-drop.wav' },
    { id: 'soft-breeze', name: 'Лёгкий бриз', file: 'soft-breeze.wav' },
];

const DEFAULT_SETTINGS = {
    theme: 'dark',
    soundId: 'soft-marimba',
    customSounds: [],
};

const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm']);

function ensureCustomSoundsDir() {
    const dir = customSoundsDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function sanitizeSoundFileName(name) {
    return String(name || 'sound')
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'sound';
}

function normalizeCustomSounds(list) {
    if (!Array.isArray(list)) return [];
    return list
        .filter((item) => item && item.id && item.file && item.name)
        .map((item) => ({
            id: String(item.id),
            name: String(item.name).slice(0, 80),
            file: path.basename(String(item.file)),
        }))
        .filter((item) => {
            const full = path.join(customSoundsDir(), item.file);
            return fs.existsSync(full) && AUDIO_EXTENSIONS.has(path.extname(item.file).toLowerCase());
        });
}

function isKnownSoundId(soundId, customSounds = []) {
    return SOUND_OPTIONS.some((item) => item.id === soundId)
        || customSounds.some((item) => item.id === soundId);
}

function readSettings() {
    try {
        if (!fs.existsSync(settingsFilePath())) return { ...DEFAULT_SETTINGS, customSounds: [] };
        const parsed = JSON.parse(fs.readFileSync(settingsFilePath(), 'utf-8'));
        const customSounds = normalizeCustomSounds(parsed.customSounds);
        const soundId = isKnownSoundId(parsed.soundId, customSounds)
            ? parsed.soundId
            : DEFAULT_SETTINGS.soundId;
        const theme = parsed.theme === 'light' ? 'light' : 'dark';
        return { theme, soundId, customSounds };
    } catch {
        return { ...DEFAULT_SETTINGS, customSounds: [] };
    }
}

function writeSettings(next) {
    const customSounds = normalizeCustomSounds(next.customSounds);
    const settings = {
        theme: next.theme === 'light' ? 'light' : 'dark',
        soundId: isKnownSoundId(next.soundId, customSounds)
            ? next.soundId
            : DEFAULT_SETTINGS.soundId,
        customSounds,
    };
    fs.writeFileSync(settingsFilePath(), JSON.stringify(settings, null, 2));
    return settings;
}

function getBuiltinSound(soundId) {
    return SOUND_OPTIONS.find((item) => item.id === soundId) || null;
}

function getCustomSound(soundId, settings = readSettings()) {
    return (settings.customSounds || []).find((item) => item.id === soundId) || null;
}

function getSoundSrc(soundId, settings = readSettings()) {
    const builtin = getBuiltinSound(soundId);
    if (builtin) return `../assets/sounds/${builtin.file}`;
    const custom = getCustomSound(soundId, settings);
    if (custom) return `pills-sound://custom/${encodeURIComponent(custom.file)}`;
    return `../assets/sounds/${SOUND_OPTIONS[0].file}`;
}

function getSoundDisplayName(soundId, settings = readSettings()) {
    const builtin = getBuiltinSound(soundId);
    if (builtin) return builtin.name;
    const custom = getCustomSound(soundId, settings);
    if (custom) return custom.name;
    return SOUND_OPTIONS[0].name;
}

function getPublicSettings() {
    const settings = readSettings();
    const builtinSounds = SOUND_OPTIONS.map((item) => ({
        id: item.id,
        name: item.name,
        src: `../assets/sounds/${item.file}`,
        custom: false,
    }));
    const customSounds = settings.customSounds.map((item) => ({
        id: item.id,
        name: item.name,
        src: `pills-sound://custom/${encodeURIComponent(item.file)}`,
        custom: true,
    }));
    return {
        theme: settings.theme,
        soundId: settings.soundId,
        sounds: [...builtinSounds, ...customSounds],
    };
}

function registerSoundProtocol() {
    protocol.registerFileProtocol('pills-sound', (request, callback) => {
        try {
            const parsed = new URL(request.url);
            const kind = parsed.hostname;
            const fileName = decodeURIComponent((parsed.pathname || '').replace(/^\/+/, ''));
            if (kind !== 'custom' || !fileName || fileName.includes('..')) {
                callback({ error: -6 });
                return;
            }
            const fullPath = path.normalize(path.join(ensureCustomSoundsDir(), path.basename(fileName)));
            const root = path.normalize(ensureCustomSoundsDir() + path.sep);
            if (!fullPath.toLowerCase().startsWith(root.toLowerCase()) || !fs.existsSync(fullPath)) {
                callback({ error: -6 });
                return;
            }
            callback({ path: fullPath });
        } catch {
            callback({ error: -2 });
        }
    });
}

function readPills() {
    const filePath = dataFilePath();
    if (!fs.existsSync(filePath)) return [];
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writePills(pills) {
    fs.writeFileSync(dataFilePath(), JSON.stringify(pills, null, 2));
}

function emitWindowState(win) {
    if (!win || win.isDestroyed()) return;
    win.webContents.send('window:state', {
        maximized: win.isMaximized(),
    });
}

function showMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
    }
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    if (process.platform === 'win32') {
        mainWindow.flashFrame(true);
    }
}

function cancelJob(pillId) {
    const key = String(pillId);
    const job = jobsByPillId.get(key);
    if (job) {
        job.cancel();
        jobsByPillId.delete(key);
    }
}

function cancelAllJobs() {
    for (const job of jobsByPillId.values()) job.cancel();
    jobsByPillId.clear();
}

function parsePillTime(pill) {
    if (!pill?.time || typeof pill.time !== 'string') return null;
    const [hours, minutes] = pill.time.split(':').map((part) => Number(part));
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
}

function stopAlarmInRenderer() {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('alarm:stop');
    }
    if (alarmWindow && !alarmWindow.isDestroyed()) {
        alarmWindow.webContents.send('alarm:stop');
    }
}

function dismissActiveNotification() {
    if (!activeNotification) return;
    try {
        activeNotification.close();
    } catch {
        // Toast may already be dismissed by the OS.
    }
    activeNotification = null;
}

function closeAlarmWindow() {
    dismissActiveNotification();
    stopAlarmInRenderer();
    if (alarmWindow && !alarmWindow.isDestroyed()) {
        alarmWindow.close();
    }
    alarmWindow = null;
}

function showAlarmWindow(payload) {
    const settings = readSettings();
    const fullPayload = {
        ...payload,
        theme: settings.theme,
        soundId: settings.soundId,
        soundSrc: getSoundSrc(settings.soundId, settings),
        soundName: getSoundDisplayName(settings.soundId, settings),
    };

    if (alarmWindow && !alarmWindow.isDestroyed()) {
        alarmWindow.show();
        alarmWindow.focus();
        alarmWindow.webContents.send('alarm:ring', fullPayload);
        return;
    }

    alarmWindow = new BrowserWindow({
        width: 380,
        height: 300,
        resizable: false,
        maximizable: false,
        minimizable: false,
        fullscreenable: false,
        frame: false,
        transparent: true,
        hasShadow: true,
        backgroundColor: '#00000000',
        alwaysOnTop: true,
        skipTaskbar: false,
        show: false,
        title: 'Напоминание',
        icon: path.join(__dirname, 'assets/img/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            autoplayPolicy: 'no-user-gesture-required',
        },
    });

    alarmWindow.setAlwaysOnTop(true, 'screen-saver');

    const sendPayload = () => {
        if (!alarmWindow || alarmWindow.isDestroyed()) return;
        alarmWindow.show();
        alarmWindow.focus();
        alarmWindow.webContents.send('alarm:ring', fullPayload);
    };

    alarmWindow.webContents.once('did-finish-load', () => {
        setTimeout(sendPayload, 50);
    });

    alarmWindow.loadFile(path.join(__dirname, 'html/alarm.html'));

    alarmWindow.on('closed', () => {
        alarmWindow = null;
    });
}

function triggerAlarm(pill, { snoozed = false } = {}) {
    const title = snoozed
        ? `Отложенное напоминание: ${pill.drugName}`
        : `Пора принять: ${pill.drugName}`;
    const body = `Дозировка: ${pill.dosage || '—'}`;
    const payload = {
        id: pill.id,
        drugName: pill.drugName,
        dosage: pill.dosage,
        time: pill.time,
        description: pill.description || '',
        snoozed,
    };

    // Separate confirmation window — do not open the main app.
    showAlarmWindow(payload);

    if (!Notification.isSupported()) return;

    dismissActiveNotification();

    const notification = new Notification({
        title,
        body,
        silent: true,
        icon: path.join(__dirname, 'assets/img/icon.png'),
        urgency: 'critical',
        timeoutType: 'never',
        actions: [
            { type: 'button', text: 'Выпил таблетку' },
            { type: 'button', text: 'Отложить 5 мин' },
        ],
        closeButtonText: 'Закрыть',
    });

    activeNotification = notification;

    notification.on('action', (_event, index) => {
        if (index === 1) {
            scheduleSnooze(pill, 5);
        }
        closeAlarmWindow();
    });

    notification.on('close', () => {
        if (activeNotification === notification) {
            activeNotification = null;
        }
    });

    // Closing the toast must not open the main app.
    notification.show();
}

function scheduleNotification(pill) {
    if (!pill?.id) return;

    const time = parsePillTime(pill);
    if (!time) return;

    cancelJob(pill.id);

    if (pill.notifyDaily) {
        const rule = new schedule.RecurrenceRule();
        rule.hour = time.hours;
        rule.minute = time.minutes;
        rule.second = 0;

        const job = schedule.scheduleJob(rule, () => triggerAlarm(pill));
        if (job) jobsByPillId.set(String(pill.id), job);
        return;
    }

    if (!pill.date) return;

    const [year, month, day] = String(pill.date).split('-').map(Number);
    if (!year || !month || !day) return;

    const when = new Date(year, month - 1, day, time.hours, time.minutes, 0, 0);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) return;

    const job = schedule.scheduleJob(when, () => {
        triggerAlarm(pill);
        jobsByPillId.delete(String(pill.id));
    });
    if (job) jobsByPillId.set(String(pill.id), job);
}

function rescheduleAll(pills = readPills()) {
    cancelAllJobs();
    pills.forEach((pill) => scheduleNotification(pill));
}

function scheduleSnooze(pill, minutes = 5) {
    const when = new Date(Date.now() + minutes * 60 * 1000);
    const snoozeKey = `snooze:${pill.id}:${when.getTime()}`;
    const job = schedule.scheduleJob(when, () => {
        triggerAlarm(pill, { snoozed: true });
        jobsByPillId.delete(snoozeKey);
    });
    if (job) jobsByPillId.set(snoozeKey, job);
    return when.toISOString();
}

let popoverBaseBounds = null;
let popoverBoundsLock = false;

function restorePopoverWindow(win = mainWindow) {
    if (!win || win.isDestroyed() || !popoverBaseBounds) {
        popoverBaseBounds = null;
        return null;
    }
    const next = { ...popoverBaseBounds };
    popoverBaseBounds = null;
    popoverBoundsLock = true;
    win.setBounds(next);
    popoverBoundsLock = false;
    return next;
}

const createWindow = () => {
    mainWindow = new BrowserWindow({
        minWidth: 380,
        minHeight: 560,
        width: 420,
        height: 720,
        frame: false,
        transparent: true,
        hasShadow: true,
        backgroundColor: '#00000000',
        roundedCorners: true,
        autoHideMenuBar: true,
        title: 'PillsNative',
        icon: path.join(__dirname, 'assets/img/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            autoplayPolicy: 'no-user-gesture-required',
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'html/index.html'));

    mainWindow.on('maximize', () => emitWindowState(mainWindow));
    mainWindow.on('unmaximize', () => emitWindowState(mainWindow));

    const onUserGeometryChange = () => {
        if (popoverBoundsLock || !popoverBaseBounds) return;
        popoverBaseBounds = null;
        mainWindow?.webContents.send('window:popover-reset');
    };

    mainWindow.on('will-move', onUserGeometryChange);
    mainWindow.on('will-resize', onUserGeometryChange);
    mainWindow.on('moved', onUserGeometryChange);
    mainWindow.on('resized', onUserGeometryChange);

    mainWindow.on('close', (event) => {
        restorePopoverWindow(mainWindow);
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        popoverBaseBounds = null;
        mainWindow = null;
    });

    mainWindow.webContents.on('did-finish-load', () => {
        rescheduleAll();
    });
};

ipcMain.handle('window:minimize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    restorePopoverWindow(win);
    win?.minimize();
});

ipcMain.handle('window:maximizeToggle', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    restorePopoverWindow(win);
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    emitWindowState(win);
});

ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    restorePopoverWindow(win);
    win?.close();
});

ipcMain.handle('window:expandForRect', (event, rect = {}) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed() || win.isMaximized()) {
        return { padLeft: 0, padTop: 0, baseWidth: 0, baseHeight: 0, expanded: false };
    }

    const pad = 10;
    if (!popoverBaseBounds) {
        popoverBaseBounds = win.getBounds();
    }
    const base = popoverBaseBounds;

    // rect is in window content coordinates (CSS px relative to current window top-left)
    const current = win.getBounds();
    const target = {
        x: current.x + (Number(rect.x) || 0),
        y: current.y + (Number(rect.y) || 0),
        width: Math.max(1, Number(rect.width) || 1),
        height: Math.max(1, Number(rect.height) || 1),
    };

    const left = Math.min(base.x, Math.floor(target.x - pad));
    const top = Math.min(base.y, Math.floor(target.y - pad));
    const right = Math.max(base.x + base.width, Math.ceil(target.x + target.width + pad));
    const bottom = Math.max(base.y + base.height, Math.ceil(target.y + target.height + pad));

    popoverBoundsLock = true;
    win.setBounds({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    });
    popoverBoundsLock = false;

    return {
        padLeft: base.x - left,
        padTop: base.y - top,
        baseWidth: base.width,
        baseHeight: base.height,
        expanded: true,
    };
});

ipcMain.handle('window:restorePopoverBounds', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    restorePopoverWindow(win);
    return true;
});

ipcMain.handle('window:setContentMinHeight', (event, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return null;

    const minHeight = Math.max(520, Math.ceil(Number(height) || 0));
    const [minWidth] = win.getMinimumSize();
    win.setMinimumSize(minWidth || 380, minHeight);

    if (win.isMaximized()) {
        return { minHeight, height: win.getBounds().height, resized: false };
    }

    // If a popover temporarily expanded the window, grow the remembered base size.
    if (popoverBaseBounds) {
        popoverBaseBounds = {
            ...popoverBaseBounds,
            height: Math.max(popoverBaseBounds.height, minHeight),
        };
    }

    const bounds = win.getBounds();
    if (bounds.height < minHeight) {
        popoverBoundsLock = true;
        win.setBounds({ ...bounds, height: minHeight });
        popoverBoundsLock = false;
        return { minHeight, height: minHeight, resized: true };
    }

    return { minHeight, height: bounds.height, resized: false };
});

ipcMain.handle('alarm:snooze', (_event, payload) => {
    const pills = readPills();
    const pill = pills.find((item) => String(item.id) === String(payload?.id)) || payload;
    if (!pill?.id) return null;
    return scheduleSnooze(pill, payload?.minutes || 5);
});

ipcMain.handle('alarm:dismiss', () => {
    closeAlarmWindow();
    return true;
});

ipcMain.handle('settings:get', () => getPublicSettings());

ipcMain.handle('settings:set', (_event, patch = {}) => {
    const current = readSettings();
    writeSettings({
        theme: patch.theme ?? current.theme,
        soundId: patch.soundId ?? current.soundId,
        customSounds: patch.customSounds ?? current.customSounds,
    });
    const publicSettings = getPublicSettings();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('settings:changed', publicSettings);
    }
    if (alarmWindow && !alarmWindow.isDestroyed()) {
        alarmWindow.webContents.send('settings:changed', publicSettings);
    }
    return publicSettings;
});

function broadcastSettings() {
    const publicSettings = getPublicSettings();
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('settings:changed', publicSettings);
    }
    if (alarmWindow && !alarmWindow.isDestroyed()) {
        alarmWindow.webContents.send('settings:changed', publicSettings);
    }
    return publicSettings;
}

ipcMain.handle('settings:addCustomSound', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const result = await dialog.showOpenDialog(win || undefined, {
        title: 'Выберите музыку для будильника',
        properties: ['openFile'],
        filters: [
            { name: 'Аудио', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'webm'] },
            { name: 'Все файлы', extensions: ['*'] },
        ],
    });
    if (result.canceled || !result.filePaths?.[0]) return getPublicSettings();

    const sourcePath = result.filePaths[0];
    const ext = path.extname(sourcePath).toLowerCase();
    if (!AUDIO_EXTENSIONS.has(ext)) {
        return { ...getPublicSettings(), error: 'Поддерживаются mp3, wav, ogg, m4a, aac, flac, webm' };
    }

    const baseName = sanitizeSoundFileName(path.basename(sourcePath, ext));
    const id = `custom-${Date.now()}`;
    const file = `${id}${ext}`;
    const dest = path.join(ensureCustomSoundsDir(), file);
    fs.copyFileSync(sourcePath, dest);

    const current = readSettings();
    const customSounds = [
        ...current.customSounds,
        { id, name: baseName, file },
    ];
    writeSettings({
        ...current,
        soundId: id,
        customSounds,
    });
    return broadcastSettings();
});

ipcMain.handle('settings:removeCustomSound', (_event, soundId) => {
    const current = readSettings();
    const target = current.customSounds.find((item) => item.id === soundId);
    if (!target) return getPublicSettings();

    const fullPath = path.join(ensureCustomSoundsDir(), target.file);
    try {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch {
        // Ignore file delete errors; still drop from settings.
    }

    const customSounds = current.customSounds.filter((item) => item.id !== soundId);
    writeSettings({
        ...current,
        soundId: current.soundId === soundId ? DEFAULT_SETTINGS.soundId : current.soundId,
        customSounds,
    });
    return broadcastSettings();
});

function buildTestPill() {
    return {
        id: 'test-alarm',
        drugName: 'Тестовый препарат',
        dosage: '1 таблетка',
        time: new Date().toTimeString().slice(0, 5),
        description: 'Проверка будильника',
    };
}

function scheduleTestAlarm(delaySeconds = 0) {
    const delay = Math.max(0, Number(delaySeconds) || 0);
    cancelJob('test-alarm');
    cancelJob('test-alarm-delay');

    if (delay <= 0) {
        triggerAlarm(buildTestPill());
        return { delaySeconds: 0, at: new Date().toISOString() };
    }

    const when = new Date(Date.now() + delay * 1000);
    const job = schedule.scheduleJob(when, () => {
        triggerAlarm(buildTestPill());
        jobsByPillId.delete('test-alarm-delay');
    });
    if (job) jobsByPillId.set('test-alarm-delay', job);
    return { delaySeconds: delay, at: when.toISOString() };
}

ipcMain.handle('alarm:test', (_event, delaySeconds = 0) => {
    if (app.isPackaged) {
        throw new Error('Test alarm is available only in development builds');
    }
    return scheduleTestAlarm(delaySeconds);
});

ipcMain.handle('app:isDev', () => !app.isPackaged);

const createTray = () => {
    tray = new Tray(path.join(__dirname, 'assets/img/icon.png'));

    const menuTemplate = [
        {
            label: 'Открыть',
            click: () => showMainWindow(),
        },
    ];

    if (!app.isPackaged) {
        menuTemplate.push({
            label: 'Тест будильника',
            submenu: [
                {
                    label: 'Сейчас',
                    click: () => scheduleTestAlarm(0),
                },
                {
                    label: 'Через 10 секунд',
                    click: () => scheduleTestAlarm(10),
                },
                {
                    label: 'Через 30 секунд',
                    click: () => scheduleTestAlarm(30),
                },
                {
                    label: 'Через 1 минуту',
                    click: () => scheduleTestAlarm(60),
                },
            ],
        });
    }

    menuTemplate.push({
        label: 'Выход',
        click: () => {
            app.isQuiting = true;
            app.quit();
        },
    });

    const contextMenu = Menu.buildFromTemplate(menuTemplate);

    tray.setToolTip('PillsNative');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else showMainWindow();
    });
};

ipcMain.on('save-form-data', (event, formData) => {
    const currentData = readPills();
    formData.id = Date.now();
    currentData.push(formData);
    writePills(currentData);
    scheduleNotification(formData);

    event.reply('save-form-data-response', 'Данные успешно сохранены!');
    event.reply('get-pills-response', currentData);
});

ipcMain.on('updatePill', (event, updatedPill) => {
    const currentData = readPills();
    const index = currentData.findIndex((pill) => pill.id === updatedPill.id);
    if (index !== -1) {
        currentData[index] = updatedPill;
        writePills(currentData);
        scheduleNotification(updatedPill);
    }
    event.reply('save-form-data-response', 'Данные успешно обновлены!');
    event.reply('get-pills-response', currentData);
});

ipcMain.on('get-pills', (event) => {
    const currentData = readPills();
    event.reply('get-pills-response', currentData);
    rescheduleAll(currentData);
});

ipcMain.on('deletePill', (event, pillId) => {
    const currentData = readPills();
    const updatedData = currentData.filter((pill) => pill.id !== pillId);
    writePills(updatedData);
    cancelJob(pillId);
    event.reply('get-pills-response', updatedData);
    event.reply('delete-pill-response', 'Таблетка успешно удалена!');
});

app.whenReady().then(() => {
    ensureCustomSoundsDir();
    registerSoundProtocol();
    createWindow();
    createTray();
    rescheduleAll();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('before-quit', () => {
    cancelAllJobs();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
