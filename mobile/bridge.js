/**
 * Mobile bridge for Capacitor/Android.
 * - Persists data via Preferences (survives app kill).
 * - Native AlarmOverlay plugin: exact alarms, overlay over other apps, tray notifications.
 */
(function initMobileBridge() {
    const PILLS_KEY = 'pillsnative.pills';
    const SETTINGS_KEY = 'pillsnative.settings';
    const MIGRATED_KEY = 'pillsnative.migrated-v1';
    const ONBOARDING_KEY = 'pillsnative.onboarding-v1';

    const listeners = {
        pills: [],
        save: [],
        deleted: [],
        settings: [],
        alarmRing: [],
        alarmStop: [],
        windowState: [],
        popoverReset: [],
        hardwareBack: null,
    };

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

    let storageReady = null;
    let memoryPills = null;
    let memorySettings = null;

    function plugin(name) {
        return window.Capacitor?.Plugins?.[name] || null;
    }

    function getPreferences() {
        return plugin('Preferences');
    }

    function getApp() {
        return plugin('App');
    }

    function getOverlay() {
        return plugin('AlarmOverlay');
    }

    function normalizeAlertMode(value) {
        return value === 'overlay' || value === 'notification' || value === 'both' ? value : 'both';
    }

    function emit(list, payload) {
        list.forEach((cb) => {
            try {
                cb(payload);
            } catch {
                // ignore
            }
        });
    }

    async function prefGet(key) {
        const Preferences = getPreferences();
        if (Preferences) {
            const result = await Preferences.get({ key });
            return result?.value ?? null;
        }
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    }

    async function prefSet(key, value) {
        const Preferences = getPreferences();
        if (Preferences) {
            await Preferences.set({ key, value });
            return;
        }
        localStorage.setItem(key, value);
    }

    async function ensureStorageReady() {
        if (storageReady) return storageReady;
        storageReady = (async () => {
            const Preferences = getPreferences();
            if (!Preferences) return;

            // One-time migrate from WebView localStorage → native Preferences.
            const migrated = await prefGet(MIGRATED_KEY);
            if (migrated === '1') return;

            try {
                const legacyPills = localStorage.getItem(PILLS_KEY);
                const legacySettings = localStorage.getItem(SETTINGS_KEY);
                const existingPills = await prefGet(PILLS_KEY);
                const existingSettings = await prefGet(SETTINGS_KEY);

                if (legacyPills && !existingPills) {
                    await Preferences.set({ key: PILLS_KEY, value: legacyPills });
                }
                if (legacySettings && !existingSettings) {
                    await Preferences.set({ key: SETTINGS_KEY, value: legacySettings });
                }
            } catch (error) {
                console.warn('[storage] migrate', error);
            }

            await Preferences.set({ key: MIGRATED_KEY, value: '1' });
        })();
        return storageReady;
    }

    async function readPills() {
        await ensureStorageReady();
        if (Array.isArray(memoryPills)) return memoryPills;
        try {
            const raw = await prefGet(PILLS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            memoryPills = Array.isArray(parsed) ? parsed : [];
        } catch {
            memoryPills = [];
        }
        return memoryPills;
    }

    async function writePills(pills) {
        memoryPills = Array.isArray(pills) ? pills : [];
        await ensureStorageReady();
        await prefSet(PILLS_KEY, JSON.stringify(memoryPills));
        // Mirror to localStorage as a backup for older webviews.
        try {
            localStorage.setItem(PILLS_KEY, JSON.stringify(memoryPills));
        } catch {
            // ignore
        }
        await persistExternalBackup();
    }

    async function readSettings() {
        await ensureStorageReady();
        if (memorySettings) return memorySettings;
        try {
            const raw = await prefGet(SETTINGS_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            memorySettings = {
                theme: parsed.theme === 'light' ? 'light' : 'dark',
                soundId: SOUND_OPTIONS.some((s) => s.id === parsed.soundId)
                    ? parsed.soundId
                    : 'soft-marimba',
                alertMode: normalizeAlertMode(parsed.alertMode),
            };
        } catch {
            memorySettings = { theme: 'dark', soundId: 'soft-marimba', alertMode: 'both' };
        }
        return memorySettings;
    }

    async function writeSettings(next) {
        memorySettings = {
            theme: next.theme === 'light' ? 'light' : 'dark',
            soundId: SOUND_OPTIONS.some((s) => s.id === next.soundId)
                ? next.soundId
                : 'soft-marimba',
            alertMode: normalizeAlertMode(next.alertMode),
        };
        await ensureStorageReady();
        await prefSet(SETTINGS_KEY, JSON.stringify(memorySettings));
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(memorySettings));
        } catch {
            // ignore
        }
        await persistExternalBackup();
        return memorySettings;
    }

    async function persistExternalBackup() {
        const Overlay = getOverlay();
        if (!Overlay?.saveBackup) return;
        try {
            const pills = memoryPills || (await readPills());
            const settings = memorySettings || (await readSettings());
            await Overlay.saveBackup({
                json: JSON.stringify({
                    version: 1,
                    savedAt: Date.now(),
                    pills,
                    settings,
                }),
            });
        } catch (error) {
            console.warn('[storage] backup', error);
        }
    }

    async function restoreExternalBackupIfNeeded() {
        const Overlay = getOverlay();
        if (!Overlay?.loadBackup) return;
        try {
            const pills = await readPills();
            if (pills.length > 0) {
                await persistExternalBackup();
                return;
            }
            const result = await Overlay.loadBackup();
            if (!result?.found || !result.json) return;
            const parsed = JSON.parse(result.json);
            if (Array.isArray(parsed?.pills) && parsed.pills.length) {
                await writePills(parsed.pills);
            }
            if (parsed?.settings && typeof parsed.settings === 'object') {
                await writeSettings({
                    theme: parsed.settings.theme,
                    soundId: parsed.settings.soundId,
                    alertMode: parsed.settings.alertMode,
                });
            }
        } catch (error) {
            console.warn('[storage] restore', error);
        }
    }

    async function publicSettings() {
        const settings = await readSettings();
        return {
            ...settings,
            platform: 'android',
            sounds: SOUND_OPTIONS.map((item) => ({
                id: item.id,
                name: item.name,
                src: `./assets/sounds/${item.file}`,
                custom: false,
            })),
        };
    }

    async function nativeSchedule() {
        const Overlay = getOverlay();
        if (!Overlay?.scheduleAll) {
            console.warn('[alarms] AlarmOverlay plugin missing — native reminders need an Android build');
            return null;
        }
        const pills = await readPills();
        const settings = await readSettings();
        try {
            return await Overlay.scheduleAll({
                pills: pills.map((pill) => ({
                    id: String(pill.id),
                    drugName: pill.drugName || '',
                    dosage: pill.dosage || '',
                    time: pill.time || '',
                    date: pill.date || null,
                    description: pill.description || '',
                    notifyDaily: Boolean(pill.notifyDaily),
                })),
                settings: {
                    theme: settings.theme,
                    soundId: settings.soundId,
                    alertMode: settings.alertMode,
                },
            });
        } catch (error) {
            console.error('[alarms] scheduleAll', error);
            return null;
        }
    }

    async function startBackground() {
        const Overlay = getOverlay();
        if (!Overlay?.startBackground) return;
        try {
            await Overlay.startBackground();
        } catch (error) {
            console.warn('[alarms] startBackground', error);
        }
    }

    async function maybeFirstLaunchPermissions() {
        const done = await prefGet(ONBOARDING_KEY);
        if (done === '1') return;
        const Overlay = getOverlay();
        if (Overlay?.runFirstLaunchSetup) {
            try {
                await Overlay.runFirstLaunchSetup();
            } catch (error) {
                console.warn('[alarms] firstLaunch', error);
            }
        }
        await prefSet(ONBOARDING_KEY, '1');
    }

    async function getAlertStatus() {
        const Overlay = getOverlay();
        if (!Overlay?.getStatus) {
            return {
                platform: 'android',
                overlay: false,
                notifications: false,
                exactAlarms: false,
                background: false,
            };
        }
        try {
            return await Overlay.getStatus();
        } catch {
            return {
                platform: 'android',
                overlay: false,
                notifications: false,
                exactAlarms: false,
                background: false,
            };
        }
    }

    async function requestAlertPermission(kind) {
        const Overlay = getOverlay();
        if (Overlay?.requestPermission) {
            try {
                await Overlay.requestPermission({ kind });
            } catch (error) {
                console.warn('[alarms] requestPermission', error);
            }
        }
        return getAlertStatus();
    }

    async function schedulePill() {
        await nativeSchedule();
    }

    async function scheduleSnooze(pill, minutes = 5) {
        const Overlay = getOverlay();
        const when = new Date(Date.now() + minutes * 60 * 1000);
        if (Overlay?.snooze && pill?.id) {
            try {
                await Overlay.snooze({ pillId: String(pill.id), minutes });
            } catch (error) {
                console.error('[alarms] snooze', error);
            }
        }
        return when.toISOString();
    }

    async function rescheduleAll() {
        await nativeSchedule();
    }

    async function cancelNative() {
        await nativeSchedule();
    }

    async function minimizeToBackground() {
        const App = getApp();
        try {
            if (App?.minimizeApp) {
                await App.minimizeApp();
                return true;
            }
        } catch {
            // fall through to native helper
        }
        const Overlay = getOverlay();
        try {
            if (Overlay?.minimizeApp) {
                await Overlay.minimizeApp();
                return true;
            }
        } catch {
            // ignore
        }
        return false;
    }

    function bindAppListeners() {
        const App = getApp();
        if (!App?.addListener || bindAppListeners.done) return;
        bindAppListeners.done = true;

        App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) {
                void startBackground();
                return;
            }
            void (async () => {
                memoryPills = null;
                const pills = await readPills();
                emit(listeners.pills, pills);
                await rescheduleAll();
            })();
        });

        // Capacitor default: if WebView has no history, back does nothing.
        App.addListener('backButton', async ({ canGoBack }) => {
            if (typeof listeners.hardwareBack === 'function') {
                try {
                    if (listeners.hardwareBack()) return;
                } catch {
                    // ignore UI handler errors
                }
            }
            if (canGoBack) {
                window.history.back();
                return;
            }
            await minimizeToBackground();
        });
    }

    window.electronAPI = {
        saveFormData: (data) => {
            void (async () => {
                const pills = await readPills();
                const next = { ...data, id: Date.now() };
                pills.push(next);
                await writePills(pills);
                await schedulePill(next);
                emit(listeners.save, 'Данные успешно сохранены!');
                emit(listeners.pills, pills);
            })();
        },
        getPills: () => {
            void (async () => {
                const pills = await readPills();
                emit(listeners.pills, pills);
                await rescheduleAll();
            })();
        },
        updatePill: (data) => {
            void (async () => {
                const pills = await readPills();
                const index = pills.findIndex((item) => String(item.id) === String(data.id));
                if (index !== -1) {
                    pills[index] = data;
                    await writePills(pills);
                    await schedulePill(data);
                }
                emit(listeners.save, 'Данные успешно обновлены!');
                emit(listeners.pills, await readPills());
            })();
        },
        deletePill: (id) => {
            void (async () => {
                const pills = (await readPills()).filter((item) => String(item.id) !== String(id));
                await writePills(pills);
                await cancelNative(id);
                emit(listeners.pills, pills);
                emit(listeners.deleted, 'Таблетка успешно удалена!');
            })();
        },
        onGetPillsResponse: (cb) => listeners.pills.push(cb),
        onSaveResponse: (cb) => listeners.save.push(cb),
        onDeletePillResponse: (cb) => listeners.deleted.push(cb),
        windowMinimize: async () => minimizeToBackground(),
        windowMaximizeToggle: async () => false,
        windowClose: async () => {
            // Never exitApp(): process kill cancels reliable delivery UX and
            // looks like "app doesn't stay in background". Minimize instead.
            await minimizeToBackground();
            return true;
        },
        onHardwareBack: (cb) => {
            listeners.hardwareBack = typeof cb === 'function' ? cb : null;
        },
        expandWindowForRect: async () => ({ padLeft: 0, padTop: 0, expanded: false }),
        restorePopoverBounds: async () => true,
        setContentMinHeight: async () => null,
        onPopoverReset: (cb) => listeners.popoverReset.push(cb),
        onWindowState: (cb) => listeners.windowState.push(cb),
        onAlarmRing: (cb) => listeners.alarmRing.push(cb),
        onAlarmStop: (cb) => listeners.alarmStop.push(cb),
        snoozeAlarm: async (payload) => {
            const whenIso = await scheduleSnooze(payload, payload?.minutes || 5);
            emit(listeners.alarmStop);
            window.location.href = './index.html';
            return whenIso;
        },
        dismissAlarm: async () => {
            const Overlay = getOverlay();
            try {
                await Overlay?.dismiss?.();
            } catch {
                // ignore
            }
            emit(listeners.alarmStop);
            window.location.href = './index.html';
            return true;
        },
        testAlarm: async () => {
            throw new Error('Test alarm is available only in development builds');
        },
        isDev: async () => false,
        getSettings: async () => publicSettings(),
        setSettings: async (patch = {}) => {
            const current = await readSettings();
            await writeSettings({
                theme: patch.theme ?? current.theme,
                soundId: patch.soundId ?? current.soundId,
                alertMode: patch.alertMode ?? current.alertMode,
            });
            await nativeSchedule();
            const pub = await publicSettings();
            emit(listeners.settings, pub);
            return pub;
        },
        getAlertStatus: async () => getAlertStatus(),
        requestAlertPermission: async (kind) => requestAlertPermission(kind),
        addCustomSound: async () => ({
            ...(await publicSettings()),
            error: 'На Android загрузите звук через файловый менеджер в следующей версии',
        }),
        removeCustomSound: async () => publicSettings(),
        onSettingsChanged: (cb) => listeners.settings.push(cb),
        getAppVersion: async () => {
            const overlay = getOverlay();
            if (overlay?.getAppVersion) {
                const info = await overlay.getAppVersion();
                return info?.version || 'android';
            }
            const App = getApp();
            if (App?.getInfo) {
                const info = await App.getInfo();
                return info?.version || 'android';
            }
            return 'android';
        },
        checkForUpdates: async () => {
            const overlay = getOverlay();
            if (!overlay?.checkForUpdates) {
                return { state: 'unsupported', reason: 'mobile' };
            }
            const result = await overlay.checkForUpdates();
            if (result?.url || result?.version) {
                window.__pillsUpdateLast = {
                    ...(window.__pillsUpdateLast || {}),
                    ...result,
                };
            }
            return result;
        },
        downloadUpdate: async () => {
            const overlay = getOverlay();
            if (!overlay?.downloadUpdate) return false;
            const last = window.__pillsUpdateLast || {};
            return overlay.downloadUpdate({
                url: last.url,
                version: last.version,
            });
        },
        installUpdate: async () => {
            const overlay = getOverlay();
            if (!overlay?.installUpdate) return;
            return overlay.installUpdate();
        },
        openReleases: async () => {
            const overlay = getOverlay();
            if (overlay?.openReleases) {
                await overlay.openReleases();
                return;
            }
            window.open('https://github.com/GoblinThug/pillsnative/releases/latest', '_blank');
        },
        onUpdateStatus: (callback) => {
            const overlay = getOverlay();
            if (!overlay?.addListener) return;
            void overlay.addListener('updateStatus', (status) => {
                if (status?.url || status?.version) {
                    window.__pillsUpdateLast = {
                        ...(window.__pillsUpdateLast || {}),
                        ...status,
                    };
                }
                callback(status);
            });
        },
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('is-mobile');
        bindAppListeners();

        if (/alarm\.html$/i.test(window.location.pathname)) {
            try {
                const raw = sessionStorage.getItem('pillsnative.alarm');
                if (raw) {
                    const payload = JSON.parse(raw);
                    sessionStorage.removeItem('pillsnative.alarm');
                    setTimeout(() => emit(listeners.alarmRing, payload), 50);
                }
            } catch {
                // ignore
            }
            return;
        }

        void (async () => {
            await ensureStorageReady();
            await restoreExternalBackupIfNeeded();
            await maybeFirstLaunchPermissions();
            await startBackground();
            const pills = await readPills();
            emit(listeners.pills, pills);
            await rescheduleAll();
        })();
    });
}());
