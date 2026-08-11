/**
 * Mobile bridge that mirrors window.electronAPI for Capacitor/Android builds.
 */
(function initMobileBridge() {
    const PILLS_KEY = 'pillsnative.pills';
    const SETTINGS_KEY = 'pillsnative.settings';
    const jobs = new Map();
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

    function readPills() {
        try {
            const parsed = JSON.parse(localStorage.getItem(PILLS_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function writePills(pills) {
        localStorage.setItem(PILLS_KEY, JSON.stringify(pills));
    }

    function readSettings() {
        try {
            const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return {
                theme: parsed.theme === 'light' ? 'light' : 'dark',
                soundId: SOUND_OPTIONS.some((s) => s.id === parsed.soundId) ? parsed.soundId : 'soft-marimba',
            };
        } catch {
            return { theme: 'dark', soundId: 'soft-marimba' };
        }
    }

    function writeSettings(next) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        return next;
    }

    function publicSettings() {
        const settings = readSettings();
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

    function emit(list, payload) {
        list.forEach((cb) => {
            try {
                cb(payload);
            } catch {
                // ignore listener errors
            }
        });
    }

    function cancelJob(id) {
        const key = String(id);
        const timer = jobs.get(key);
        if (timer) {
            clearTimeout(timer);
            jobs.delete(key);
        }
    }

    function nextTriggerDate(pill) {
        if (!pill?.time || !/^\d{2}:\d{2}$/.test(pill.time)) return null;
        const [hh, mm] = pill.time.split(':').map(Number);
        const now = new Date();
        let when = new Date();
        if (pill.notifyDaily) {
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

    function triggerAlarm(pill, { snoozed = false } = {}) {
        const settings = readSettings();
        const sound = SOUND_OPTIONS.find((item) => item.id === settings.soundId) || SOUND_OPTIONS[0];
        const payload = {
            ...pill,
            snoozed,
            theme: settings.theme,
            soundId: settings.soundId,
            soundSrc: `./assets/sounds/${sound.file}`,
        };

        if (window.Capacitor?.Plugins?.LocalNotifications) {
            window.Capacitor.Plugins.LocalNotifications.schedule({
                notifications: [{
                    id: Number(String(Date.now()).slice(-8)),
                    title: snoozed ? 'Отложенное напоминание' : 'Пора принять лекарство',
                    body: `${pill.drugName || 'Лекарство'} — ${pill.dosage || ''}`.trim(),
                    schedule: { at: new Date(Date.now() + 200) },
                }],
            }).catch(() => {});
        }

        // Open alarm page in same webview.
        try {
            sessionStorage.setItem('pillsnative.alarm', JSON.stringify(payload));
            window.location.href = './alarm.html';
        } catch {
            emit(listeners.alarmRing, payload);
        }
    }

    function schedulePill(pill) {
        cancelJob(pill.id);
        const when = nextTriggerDate(pill);
        if (!when) return;
        const delay = Math.max(0, when.getTime() - Date.now());
        const timer = setTimeout(() => {
            triggerAlarm(pill);
            jobs.delete(String(pill.id));
            if (pill.notifyDaily) schedulePill(pill);
        }, delay);
        jobs.set(String(pill.id), timer);
    }

    function rescheduleAll() {
        [...jobs.keys()].forEach(cancelJob);
        readPills().forEach(schedulePill);
    }

    window.electronAPI = {
        saveFormData: (data) => {
            const pills = readPills();
            const next = { ...data, id: Date.now() };
            pills.push(next);
            writePills(pills);
            schedulePill(next);
            emit(listeners.save, 'Данные успешно сохранены!');
            emit(listeners.pills, pills);
        },
        getPills: () => {
            const pills = readPills();
            emit(listeners.pills, pills);
            rescheduleAll();
        },
        updatePill: (data) => {
            const pills = readPills();
            const index = pills.findIndex((item) => String(item.id) === String(data.id));
            if (index !== -1) {
                pills[index] = data;
                writePills(pills);
                schedulePill(data);
            }
            emit(listeners.save, 'Данные успешно обновлены!');
            emit(listeners.pills, pills);
        },
        deletePill: (id) => {
            const pills = readPills().filter((item) => String(item.id) !== String(id));
            writePills(pills);
            cancelJob(id);
            emit(listeners.pills, pills);
            emit(listeners.deleted, 'Таблетка успешно удалена!');
        },
        onGetPillsResponse: (cb) => listeners.pills.push(cb),
        onSaveResponse: (cb) => listeners.save.push(cb),
        onDeletePillResponse: (cb) => listeners.deleted.push(cb),
        windowMinimize: async () => false,
        windowMaximizeToggle: async () => false,
        windowClose: async () => {
            if (window.Capacitor?.Plugins?.App) {
                window.Capacitor.Plugins.App.exitApp();
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
            const minutes = payload?.minutes || 5;
            const when = new Date(Date.now() + minutes * 60 * 1000);
            setTimeout(() => triggerAlarm(payload, { snoozed: true }), minutes * 60 * 1000);
            emit(listeners.alarmStop);
            window.location.href = './index.html';
            return when.toISOString();
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
            const current = readSettings();
            const next = writeSettings({
                theme: patch.theme ?? current.theme,
                soundId: patch.soundId ?? current.soundId,
            });
            const pub = publicSettings();
            emit(listeners.settings, pub);
            return pub;
        },
        addCustomSound: async () => ({
            ...publicSettings(),
            error: 'На Android загрузите звук через файловый менеджер в следующей версии',
        }),
        removeCustomSound: async () => publicSettings(),
        onSettingsChanged: (cb) => listeners.settings.push(cb),
    };

    document.addEventListener('DOMContentLoaded', () => {
        document.documentElement.classList.add('is-mobile');
        if (window.location.pathname.endsWith('alarm.html')) {
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
        }
        rescheduleAll();
    });
}());
