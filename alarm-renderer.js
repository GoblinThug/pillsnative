document.addEventListener('DOMContentLoaded', () => {
    const alarmApp = document.querySelector('.alarm-app');
    const alarmBadge = document.getElementById('alarmBadge');
    const alarmDrug = document.getElementById('alarmDrug');
    const alarmMeta = document.getElementById('alarmMeta');
    const alarmDesc = document.getElementById('alarmDesc');
    const alarmTime = document.getElementById('alarmTime');
    const alarmDismiss = document.getElementById('alarmDismiss');
    const alarmSnooze = document.getElementById('alarmSnooze');
    const alarmAudio = document.getElementById('alarmAudio');

    let activeAlarm = null;
    let closing = false;

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    }

    async function startAlarmSound(src) {
        stopAlarmSound();
        try {
            alarmAudio.src = src || '../assets/sounds/soft-marimba.wav';
            alarmAudio.loop = true;
            alarmAudio.currentTime = 0;
            alarmAudio.volume = 0.22;
            await alarmAudio.play();
        } catch {
            // Keep window usable even if audio fails.
        }
    }

    function stopAlarmSound() {
        alarmAudio.pause();
        alarmAudio.currentTime = 0;
    }

    async function showAlarm(payload) {
        activeAlarm = payload;
        closing = false;
        alarmApp.classList.remove('is-leaving');
        applyTheme(payload.theme);
        alarmBadge.textContent = payload.snoozed ? 'Отложено' : 'Пора принять';
        alarmDrug.textContent = payload.drugName || 'Лекарство';
        alarmMeta.textContent = payload.dosage || 'Без дозировки';
        alarmTime.textContent = payload.time || '--:--';
        alarmDesc.textContent = payload.description || 'Подтвердите приём, когда выпьете препарат.';
        await startAlarmSound(payload.soundSrc);
    }

    async function closeWithAnimation(beforeClose) {
        if (closing) return;
        closing = true;
        const snapshot = activeAlarm;
        stopAlarmSound();
        activeAlarm = null;
        alarmApp.classList.add('is-leaving');
        await new Promise((resolve) => setTimeout(resolve, 180));
        if (beforeClose) await beforeClose(snapshot);
        await window.electronAPI.dismissAlarm();
    }

    alarmDismiss.addEventListener('click', () => {
        void closeWithAnimation();
    });

    alarmSnooze.addEventListener('click', () => {
        void closeWithAnimation(async (payload) => {
            if (!payload?.id) return;
            await window.electronAPI.snoozeAlarm({
                id: payload.id,
                drugName: payload.drugName,
                dosage: payload.dosage,
                time: payload.time,
                description: payload.description,
                minutes: 5,
            });
        });
    });

    window.electronAPI.onAlarmRing((payload) => {
        void showAlarm(payload);
    });

    window.electronAPI.onAlarmStop(() => {
        stopAlarmSound();
        activeAlarm = null;
    });

    window.electronAPI.onSettingsChanged((settings) => {
        applyTheme(settings.theme);
    });
});
