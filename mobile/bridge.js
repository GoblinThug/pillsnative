/**
 * Mobile bridge for Capacitor/Android.
 * - Persists data via Preferences (survives app kill; localStorage alone is unreliable).
 * - Schedules native LocalNotifications with allowWhileIdle (fire when app is closed).
 */
(function initMobileBridge() {
    const PILLS_KEY = 'pillsnative.pills';
    const SETTINGS_KEY = 'pillsnative.settings';
    const MIGRATED_KEY = 'pillsnative.migrated-v1';
    const CHANNEL_ID = 'pills-alarms';

    const listeners = {
        pills: [],
        save: [],
        deleted: [],
        settings: [],
        alarmRing: [],
        alarmStop: [],
        windowState: [],
        popoverReset: [],
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

    function getLN() {
        return plugin('LocalNotifications');
    }

    function getApp() {
        return plugin('App');
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
            };
        } catch {
            memorySettings = { theme: 'dark', soundId: 'soft-marimba' };
        }
        return memorySettings;
    }

    async function writeSettings(next) {
        memorySettings = {
            theme: next.theme === 'light' ? 'light' : 'dark',
            soundId: SOUND_OPTIONS.some((s) => s.id === next.soundId)
                ? next.soundId
                : 'soft-marimba',
        };
        await ensureStorageReady();
        await prefSet(SETTINGS_KEY, JSON.stringify(memorySettings));
        try {
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(memorySettings));
        } catch {
            // ignore
        }
        return memorySettings;
    }

    async function publicSettings() {
        const settings = await readSettings();
        return {
            ...settings,
            sounds: SOUND_OPTIONS.map((item) => ({
                id: item.id,
                name: item.name,
                src: `./assets/sounds/${item.file}`,
                custom: false,
            })),
        };
    }

    function notificationIdFor(pillId, salt = 0) {
        const raw = `${salt}:${pillId}`;
        let hash = 2166136261;
        for (let i = 0; i < raw.length; i += 1) {
            hash ^= raw.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0) % 2147483646 + 1;
    }

    function nextTriggerDate(pill) {
        if (!pill?.time || !/^\d{2}:\d{2}$/.test(pill.time)) return null;
        const [hh, mm] = pill.time.split(':').map(Number);
        const now = new Date();
        let when = new Date();
        if (pill.notifyDaily) {
            when.setSeconds(0, 0);
            when.setHours(hh, mm, 0, 0);
            if (when <= now) when.setDate(when.getDate() + 1);
            return when;
        }
        if (!pill.date) return null;
        const [y, m, d] = String(pill.date).split('-').map(Number);
        when = new Date(y, m - 1, d, hh, mm, 0, 0);
        if (when <= now) return null;
        return when;
    }

    async function alarmPayload(pill, { snoozed = false } = {}) {
        const settings = await readSettings();
        const sound = SOUND_OPTIONS.find((item) => item.id === settings.soundId) || SOUND_OPTIONS[0];
        return {
            ...pill,
            snoozed,
            theme: settings.theme,
            soundId: settings.soundId,
            soundSrc: `./assets/sounds/${sound.file}`,
        };
    }

    async function openAlarm(pill, opts = {}) {
        const payload = await alarmPayload(pill, opts);
        try {
            sessionStorage.setItem('pillsnative.alarm', JSON.stringify(payload));
            if (!/alarm\.html$/i.test(window.location.pathname)) {
                window.location.href = './alarm.html';
            } else {
                emit(listeners.alarmRing, payload);
            }
        } catch {
            emit(listeners.alarmRing, payload);
        }
    }

    async function ensureExactAlarms() {
        const LN = getLN();
        if (!LN?.checkExactNotificationSetting) return;
        try {
            const status = await LN.checkExactNotificationSetting();
            const exact = status?.exact_alarm || status?.exactAlarm;
            if (exact === 'granted') return;
            if (typeof LN.changeExactNotificationSetting === 'function') {
                await LN.changeExactNotificationSetting();
            }
        } catch (error) {
            console.warn('[notifications] exact alarm setting', error);
        }
    }

    async function ensurePermissions() {
        const LN = getLN();
        if (!LN) return false;
        try {
            let perm = await LN.checkPermissions();
            if (perm.display !== 'granted') {
                perm = await LN.requestPermissions();
            }
            if (perm.display === 'granted') {
                await ensureExactAlarms();
            }
            return perm.display === 'granted';
        } catch (error) {
            console.error('[notifications] permissions', error);
            return false;
        }
    }

    async function ensureChannel() {
        const LN = getLN();
        if (!LN?.createChannel) return;
        try {
            await LN.createChannel({
                id: CHANNEL_ID,
                name: 'Напоминания о лекарствах',
                description: 'Работает, даже когда приложение закрыто',
                importance: 5,
                visibility: 1,
                sound: 'default',
                vibration: true,
                lights: true,
            });
        } catch (error) {
            console.warn('[notifications] channel', error);
        }
    }

    async function cancelNative(pillId) {
        const LN = getLN();
        if (!LN) return;
        const ids = [0, 1].map((salt) => ({ id: notificationIdFor(pillId, salt) }));
        try {
            await LN.cancel({ notifications: ids });
        } catch (error) {
            console.warn('[notifications] cancel', error);
        }
    }

    function buildNotification(pill, when, { snoozed = false, idSalt = 0 } = {}) {
        const [hh, mm] = String(pill.time || '09:00').split(':').map(Number);
        const title = snoozed ? 'Отложенное напоминание' : 'Пора принять лекарство';
        const body = `${pill.drugName || 'Лекарство'}${pill.dosage ? ` — ${pill.dosage}` : ''}`;
        const base = {
            id: notificationIdFor(pill.id, idSalt),
            title,
            body,
            channelId: CHANNEL_ID,
            autoCancel: true,
            ongoing: false,
            extra: {
                pillId: String(pill.id),
                snoozed: Boolean(snoozed),
                drugName: pill.drugName || '',
                dosage: pill.dosage || '',
                time: pill.time || '',
                description: pill.description || '',
                notifyDaily: Boolean(pill.notifyDaily),
                date: pill.date || null,
            },
        };

        if (pill.notifyDaily && !snoozed) {
            return {
                ...base,
                schedule: {
                    on: { hour: hh, minute: mm },
                    repeats: true,
                    allowWhileIdle: true,
                },
            };
        }

        return {
            ...base,
            schedule: {
                at: when,
                allowWhileIdle: true,
            },
        };
    }

    async function schedulePill(pill) {
        await cancelNative(pill.id);
        const LN = getLN();
        if (!LN) {
            console.warn('[notifications] plugin missing — reminders need a native build');
            return;
        }

        const granted = await ensurePermissions();
        if (!granted) {
            console.warn('[notifications] permission denied');
            return;
        }
        await ensureChannel();

        let when = nextTriggerDate(pill);
        if (!when && pill.notifyDaily) {
            when = nextTriggerDate({ ...pill, notifyDaily: true });
        }
        if (!when && !pill.notifyDaily) return;

        const notification = buildNotification(pill, when, { snoozed: false, idSalt: 0 });
        try {
            await LN.schedule({ notifications: [notification] });
            console.log('[notifications] scheduled', pill.drugName, notification.schedule);
        } catch (error) {
            console.error('[notifications] schedule', error);
        }
    }

    async function scheduleSnooze(pill, minutes = 5) {
        const LN = getLN();
        if (!LN) return null;
        await ensurePermissions();
        await ensureChannel();
        const when = new Date(Date.now() + minutes * 60 * 1000);
        const notification = buildNotification(pill, when, { snoozed: true, idSalt: 1 });
        try {
            await LN.schedule({ notifications: [notification] });
        } catch (error) {
            console.error('[notifications] snooze', error);
        }
        return when.toISOString();
    }

    async function rescheduleAll() {
        const pills = await readPills();
        const LN = getLN();
        if (LN?.getPending) {
            try {
                const pending = await LN.getPending();
                const cancel = (pending?.notifications || []).map((item) => ({ id: item.id }));
                if (cancel.length) await LN.cancel({ notifications: cancel });
            } catch {
                // ignore
            }
        }
        for (const pill of pills) {
            // eslint-disable-next-line no-await-in-loop
            await schedulePill(pill);
        }
    }

    function pillFromExtra(extra = {}) {
        return {
            id: extra.pillId || `notif-${Date.now()}`,
            drugName: extra.drugName || 'Лекарство',
            dosage: extra.dosage || '',
            time: extra.time || '',
            description: extra.description || '',
            notifyDaily: Boolean(extra.notifyDaily),
            date: extra.date || null,
        };
    }

    function bindNotificationListeners() {
        const LN = getLN();
        if (!LN?.addListener || bindNotificationListeners.done) return;
        bindNotificationListeners.done = true;

        LN.addListener('localNotificationActionPerformed', (event) => {
            const extra = event?.notification?.extra || {};
            void openAlarm(pillFromExtra(extra), { snoozed: Boolean(extra.snoozed) });
        });

        LN.addListener('localNotificationReceived', (notification) => {
            const extra = notification?.extra || {};
            void openAlarm(pillFromExtra(extra), { snoozed: Boolean(extra.snoozed) });
        });
    }

    function bindAppListeners() {
        const App = getApp();
        if (!App?.addListener || bindAppListeners.done) return;
        bindAppListeners.done = true;

        App.addListener('appStateChange', ({ isActive }) => {
            if (!isActive) return;
            void (async () => {
                memoryPills = null;
                const pills = await readPills();
                emit(listeners.pills, pills);
                await rescheduleAll();
            })();
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
        windowMinimize: async () => false,
        windowMaximizeToggle: async () => false,
        windowClose: async () => {
            // Never exitApp(): process kill cancels reliable delivery UX and
            // looks like "app doesn't stay in background". Minimize instead.
            const App = getApp();
            if (App?.minimizeApp) {
                await App.minimizeApp();
            }
            return true;
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
            });
            const pub = await publicSettings();
            emit(listeners.settings, pub);
            return pub;
        },
        addCustomSound: async () => ({
            ...(await publicSettings()),
            error: 'На Android загрузите звук через файловый менеджер в следующей версии',
        }),
        removeCustomSound: async () => publicSettings(),
        onSettingsChanged: (cb) => listeners.settings.push(cb),
        getAppVersion: async () => 'mobile',
        checkForUpdates: async () => ({ state: 'unsupported', reason: 'dev' }),
        downloadUpdate: async () => false,
        installUpdate: async () => {},
        openReleases: async () => {
            window.open('https://github.com/GoblinThug/pillsnative/releases/latest', '_blank');
        },
        onUpdateStatus: () => {},
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('is-mobile');
        bindNotificationListeners();
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
            await ensurePermissions();
            await ensureChannel();
            const pills = await readPills();
            emit(listeners.pills, pills);
            await rescheduleAll();
        })();
    });
}());
