document.addEventListener('DOMContentLoaded', () => {
    const addPillsButton = document.getElementById('toggleForm');
    const addPillFooter = document.getElementById('addPillFooter');
    const closeFormButton = document.getElementById('closeForm');
    const cancelFormButton = document.getElementById('cancelForm');
    const saveButton = document.getElementById('save');
    const deleteButton = document.getElementById('delete');
    const successMessage = document.getElementById('success');
    const errorMessage = document.getElementById('error');
    const drugNameInput = document.getElementById('drugName');
    const dosageInput = document.getElementById('dosage');
    const drugSuggestMenu = document.getElementById('drugSuggestMenu');
    const dosageSuggestMenu = document.getElementById('dosageSuggestMenu');
    const dateInput = document.getElementById('date');
    const dateField = document.getElementById('dateField');
    const timeInput = document.getElementById('time');
    const notifyDailyInput = document.getElementById('notifyDaily');
    const notifyDailyField = document.getElementById('notifyDailyField');
    const descriptionInput = document.getElementById('description');
    const pillListContainer = document.getElementById('pillList');
    const emptyState = document.getElementById('emptyState');
    const listView = document.getElementById('listView');
    const formView = document.getElementById('formView');
    const formHeading = document.getElementById('formHeading');
    const toolbarTitle = document.getElementById('toolbarTitle');
    const toolbarSubtitle = document.getElementById('toolbarSubtitle');
    const searchInput = document.getElementById('search');

    const datePicker = document.getElementById('datePicker');
    const dateTrigger = document.getElementById('dateTrigger');
    const datePopover = document.getElementById('datePopover');
    const dateDisplay = document.getElementById('dateDisplay');
    const calTitle = document.getElementById('calTitle');
    const calGrid = document.getElementById('calGrid');
    const calPrev = document.getElementById('calPrev');
    const calNext = document.getElementById('calNext');
    const calToday = document.getElementById('calToday');

    const timePicker = document.getElementById('timePicker');
    const timeTrigger = document.getElementById('timeTrigger');
    const timePopover = document.getElementById('timePopover');
    const timeDisplay = document.getElementById('timeDisplay');
    const hourList = document.getElementById('hourList');
    const minuteList = document.getElementById('minuteList');
    const timeApply = document.getElementById('timeApply');

    let currentPillId = null;
    let allPills = [];
    let calendarCursor = startOfMonth(new Date());
    let draftHour = 9;
    let draftMinute = 0;

    const monthFormatter = new Intl.DateTimeFormat('ru-RU', {
        month: 'long',
        year: 'numeric',
    });
    const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function startOfMonth(date) {
        return new Date(date.getFullYear(), date.getMonth(), 1);
    }

    function toIsoDate(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function parseIsoDate(value) {
        if (!value) return null;
        const [year, month, day] = value.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    function applyPopoverEscape(inset) {
        if (!inset?.expanded) {
            document.documentElement.classList.remove('has-popover-escape');
            return;
        }
        document.documentElement.classList.add('has-popover-escape');
        document.documentElement.style.setProperty('--app-offset-x', `${inset.padLeft || 0}px`);
        document.documentElement.style.setProperty('--app-offset-y', `${inset.padTop || 0}px`);
        document.documentElement.style.setProperty('--app-base-width', `${inset.baseWidth}px`);
        document.documentElement.style.setProperty('--app-base-height', `${inset.baseHeight}px`);
    }

    async function clearPopoverEscape() {
        document.documentElement.classList.remove('has-popover-escape');
        document.documentElement.style.removeProperty('--app-offset-x');
        document.documentElement.style.removeProperty('--app-offset-y');
        document.documentElement.style.removeProperty('--app-base-width');
        document.documentElement.style.removeProperty('--app-base-height');
        if (typeof window.electronAPI?.restorePopoverBounds === 'function') {
            await window.electronAPI.restorePopoverBounds();
        }
    }

    function closePickers(except) {
        if (except !== 'date') {
            datePicker.classList.remove('is-open');
            datePopover.hidden = true;
        }
        if (except !== 'time') {
            timePicker.classList.remove('is-open');
            timePopover.hidden = true;
        }
        const anyOpen = datePicker.classList.contains('is-open') || timePicker.classList.contains('is-open');
        if (!anyOpen) void clearPopoverEscape();
    }

    function syncDateDisplay() {
        const parsed = parseIsoDate(dateInput.value);
        if (!parsed) {
            dateDisplay.textContent = 'Выберите дату';
            dateDisplay.classList.add('is-placeholder');
            return;
        }
        dateDisplay.textContent = dateFormatter.format(parsed);
        dateDisplay.classList.remove('is-placeholder');
    }

    function syncTimeDisplay() {
        if (!timeInput.value) {
            timeDisplay.textContent = 'Выберите время';
            timeDisplay.classList.add('is-placeholder');
            return;
        }
        timeDisplay.textContent = timeInput.value;
        timeDisplay.classList.remove('is-placeholder');
    }

    function syncCheckbox() {
        notifyDailyField.classList.toggle('is-checked', notifyDailyInput.checked);
    }

    function setDateValue(value) {
        dateInput.value = value || '';
        if (value) calendarCursor = startOfMonth(parseIsoDate(value) || new Date());
        syncDateDisplay();
        renderCalendar();
    }

    function setTimeValue(value) {
        timeInput.value = value || '';
        if (value && /^\d{2}:\d{2}$/.test(value)) {
            const [h, m] = value.split(':').map(Number);
            draftHour = h;
            draftMinute = m;
        }
        syncTimeDisplay();
        renderTimeLists();
    }

    function renderCalendar() {
        const selected = parseIsoDate(dateInput.value);
        const today = new Date();
        const year = calendarCursor.getFullYear();
        const month = calendarCursor.getMonth();
        const firstDay = new Date(year, month, 1);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const gridStart = new Date(year, month, 1 - startOffset);

        calTitle.textContent = monthFormatter.format(calendarCursor);
        calGrid.innerHTML = '';

        for (let i = 0; i < 42; i += 1) {
            const day = new Date(gridStart);
            day.setDate(gridStart.getDate() + i);
            const iso = toIsoDate(day);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'calendar__day';
            button.textContent = String(day.getDate());
            button.dataset.date = iso;

            if (day.getMonth() !== month) button.classList.add('is-muted');
            if (toIsoDate(today) === iso) button.classList.add('is-today');
            if (selected && toIsoDate(selected) === iso) button.classList.add('is-selected');

            button.addEventListener('click', () => {
                setDateValue(iso);
                closePickers();
            });

            calGrid.appendChild(button);
        }
    }

    function renderTimeLists() {
        hourList.innerHTML = '';
        minuteList.innerHTML = '';

        for (let hour = 0; hour < 24; hour += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-picker__option';
            button.textContent = pad(hour);
            if (hour === draftHour) button.classList.add('is-selected');
            button.addEventListener('click', () => {
                draftHour = hour;
                renderTimeLists();
                scrollTimeSelection();
            });
            hourList.appendChild(button);
        }

        for (let minute = 0; minute < 60; minute += 1) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'time-picker__option';
            button.textContent = pad(minute);
            if (minute === draftMinute) button.classList.add('is-selected');
            button.addEventListener('click', () => {
                draftMinute = minute;
                renderTimeLists();
                scrollTimeSelection();
            });
            minuteList.appendChild(button);
        }
    }

    function scrollOptionIntoView(list, selected) {
        if (!list || !selected) return;
        const listRect = list.getBoundingClientRect();
        const itemRect = selected.getBoundingClientRect();
        const offset = (itemRect.top - listRect.top) - (list.clientHeight / 2) + (itemRect.height / 2);
        list.scrollTop += offset;
    }

    function scrollTimeSelection() {
        scrollOptionIntoView(hourList, hourList.querySelector('.is-selected'));
        scrollOptionIntoView(minuteList, minuteList.querySelector('.is-selected'));
    }

    function mountPopover(popover) {
        if (popover.parentElement !== document.body) {
            document.body.appendChild(popover);
        }
    }

    async function placeFloatingMenu(trigger, popover, {
        align = 'left',
        gap = 6,
        fallbackWidth = 220,
        fallbackHeight = 240,
        preferBelow = true,
    } = {}) {
        mountPopover(popover);
        await clearPopoverEscape();

        popover.hidden = false;
        popover.style.visibility = 'hidden';

        const rect = trigger.getBoundingClientRect();
        const width = popover.offsetWidth || fallbackWidth;
        const height = popover.offsetHeight || fallbackHeight;

        let left = align === 'right' ? rect.right - width : rect.left;
        const gapBelow = rect.bottom + gap;
        const gapAbove = rect.top - height - gap;
        const screenTop = window.screen.availTop;
        const screenBottom = window.screen.availTop + window.screen.availHeight;
        const fitsBelowOnScreen = (window.screenY + gapBelow + height) <= screenBottom - 4;
        const fitsAboveOnScreen = (window.screenY + gapAbove) >= screenTop + 4;

        let top = preferBelow ? gapBelow : gapAbove;
        if (preferBelow && !fitsBelowOnScreen && fitsAboveOnScreen) top = gapAbove;
        if (!preferBelow && !fitsAboveOnScreen && fitsBelowOnScreen) top = gapBelow;

        const screenLeft = window.screen.availLeft;
        const screenRight = window.screen.availLeft + window.screen.availWidth;
        if (window.screenX + left < screenLeft + 4) left = screenLeft + 4 - window.screenX;
        if (window.screenX + left + width > screenRight - 4) left = screenRight - 4 - width - window.screenX;

        const localRect = {
            x: Math.round(left),
            y: Math.round(top),
            width: Math.round(width),
            height: Math.round(height),
        };

        let inset = { padLeft: 0, padTop: 0, expanded: false };
        if (typeof window.electronAPI?.expandWindowForRect === 'function') {
            inset = await window.electronAPI.expandWindowForRect(localRect) || inset;
        }
        applyPopoverEscape(inset);

        popover.style.left = `${left + (inset.padLeft || 0)}px`;
        popover.style.top = `${top + (inset.padTop || 0)}px`;
        popover.style.visibility = '';
        return inset;
    }

    async function openDatePicker() {
        closePickers('date');
        closeTestMenu();
        const open = datePicker.classList.toggle('is-open');
        datePopover.hidden = !open;
        if (open) {
            if (dateInput.value) calendarCursor = startOfMonth(parseIsoDate(dateInput.value) || new Date());
            renderCalendar();
            await placeFloatingMenu(dateTrigger, datePopover, {
                align: 'left',
                fallbackWidth: 248,
                fallbackHeight: 300,
            });
        } else {
            await clearPopoverEscape();
        }
    }

    async function openTimePicker() {
        closePickers('time');
        closeTestMenu();
        const open = timePicker.classList.toggle('is-open');
        timePopover.hidden = !open;
        if (open) {
            if (timeInput.value && /^\d{2}:\d{2}$/.test(timeInput.value)) {
                const [h, m] = timeInput.value.split(':').map(Number);
                draftHour = h;
                draftMinute = m;
            } else {
                const now = new Date();
                draftHour = now.getHours();
                draftMinute = now.getMinutes();
            }
            renderTimeLists();
            await placeFloatingMenu(timeTrigger, timePopover, {
                align: 'right',
                fallbackWidth: 220,
                fallbackHeight: 280,
            });
            scrollTimeSelection();
        } else {
            await clearPopoverEscape();
        }
    }

    function showList() {
        listView.classList.add('is-active');
        formView.classList.remove('is-active');
        toolbarTitle.textContent = 'Приёмы';
        toolbarSubtitle.textContent = allPills.length
            ? `${allPills.length} в расписании`
            : 'Напоминания о лекарствах';
        addPillsButton.title = 'Добавить приём';
        addPillsButton.setAttribute('aria-label', 'Добавить приём');
        closePickers();
        scheduleWindowFit();
    }

    function showForm(mode) {
        listView.classList.remove('is-active');
        formView.classList.add('is-active');
        formHeading.textContent = mode === 'edit' ? 'Редактирование' : 'Новый приём';
        toolbarTitle.textContent = mode === 'edit' ? 'Редактирование' : 'Новый приём';
        toolbarSubtitle.textContent = mode === 'edit' ? 'Измените данные и сохраните' : 'Заполните поля ниже';
        addPillsButton.title = 'К списку';
        addPillsButton.setAttribute('aria-label', 'К списку');
        closePickers();
        scheduleWindowFit();
    }

    function toggleDateField(hide) {
        dateField.classList.toggle('is-hidden', hide);
        if (hide) setDateValue('');
        closePickers();
        scheduleWindowFit();
    }

    function setFeedback(type, message) {
        errorMessage.classList.remove('is-visible');
        successMessage.classList.remove('is-visible');
        errorMessage.textContent = '';
        successMessage.textContent = '';

        if (!message) return;

        if (type === 'error') {
            errorMessage.textContent = message;
            errorMessage.classList.add('is-visible');
        } else {
            successMessage.textContent = message;
            successMessage.classList.add('is-visible');
        }
    }

    function clearForm() {
        drugNameInput.value = '';
        dosageInput.value = '';
        setDateValue('');
        setTimeValue('');
        notifyDailyInput.checked = false;
        syncCheckbox();
        descriptionInput.value = '';
        toggleDateField(false);
        setFeedback();
        currentPillId = null;
        toggleDeleteButton(false);
        closePickers();
    }

    function toggleDeleteButton(show) {
        deleteButton.classList.toggle('hidden', !show);
        scheduleWindowFit();
    }

    let windowFitTimer = null;
    function scheduleWindowFit() {
        clearTimeout(windowFitTimer);
        windowFitTimer = setTimeout(() => {
            void fitWindowToContent();
        }, 16);
    }

    function measureFormBodyHeight() {
        const panel = formView.querySelector('.panel');
        const heading = formView.querySelector('.panel__heading');
        const form = document.getElementById('addPillsForm');
        if (!panel || !heading || !form) return 0;

        const wasActive = formView.classList.contains('is-active');
        if (!wasActive) {
            formView.style.display = 'flex';
            formView.style.position = 'absolute';
            formView.style.visibility = 'hidden';
            formView.style.pointerEvents = 'none';
            formView.style.inset = '0';
            formView.style.zIndex = '-1';
        }

        const panelStyles = getComputedStyle(panel);
        const padTop = parseFloat(panelStyles.paddingTop) || 0;
        const padBottom = parseFloat(panelStyles.paddingBottom) || 0;
        const headingMargin = parseFloat(getComputedStyle(heading).marginBottom) || 0;
        const height = padTop
            + heading.offsetHeight
            + headingMargin
            + form.scrollHeight
            + padBottom;

        if (!wasActive) {
            formView.style.display = '';
            formView.style.position = '';
            formView.style.visibility = '';
            formView.style.pointerEvents = '';
            formView.style.inset = '';
            formView.style.zIndex = '';
        }

        return Math.ceil(height);
    }

    async function fitWindowToContent() {
        if (typeof window.electronAPI?.setContentMinHeight !== 'function') return;

        const titlebar = document.querySelector('.titlebar');
        const toolbar = document.querySelector('.toolbar');
        const chrome = (titlebar?.offsetHeight || 40) + (toolbar?.offsetHeight || 0);
        const body = measureFormBodyHeight();
        // Keep a little breathing room so controls aren't flush with the edge.
        const minHeight = chrome + body + 8;
        await window.electronAPI.setContentMinHeight(minHeight);
    }

    function openCreateForm() {
        clearForm();
        showForm('create');
    }

    function closeToList() {
        clearForm();
        showList();
    }

    function renderPills(pills) {
        const query = searchInput.value.trim().toLowerCase();
        const filtered = query
            ? pills.filter((pill) =>
                [pill.drugName, pill.dosage, pill.description]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(query))
            )
            : pills;

        pillListContainer.innerHTML = '';

        if (!filtered.length) {
            emptyState.classList.remove('hidden');
            emptyState.querySelector('h2').textContent = query ? 'Ничего не найдено' : 'Пока пусто';
            emptyState.querySelector('p').textContent = query
                ? 'Попробуйте другой запрос или сбросьте поиск.'
                : 'Добавьте первый приём — приложение напомнит, когда пора принять лекарство.';
            return;
        }

        emptyState.classList.add('hidden');

        filtered.forEach((pill) => {
            const pillItem = document.createElement('button');
            pillItem.type = 'button';
            pillItem.className = 'pill-item';
            if (currentPillId === pill.id) pillItem.classList.add('is-active');

            const scheduleLabel = pill.notifyDaily ? 'Каждый день' : (pill.date || 'Без даты');
            const description = pill.description || 'Без описания';

            pillItem.innerHTML = `
                <div class="pill-item__top">
                    <div>
                        <div class="pill-item__name"></div>
                        <div class="pill-item__dosage"></div>
                    </div>
                    <div class="pill-item__meta">
                        <span class="pill-item__badge"></span>
                        <span class="pill-item__time"></span>
                    </div>
                </div>
                <div class="pill-item__desc"></div>
            `;

            pillItem.querySelector('.pill-item__name').textContent = pill.drugName;
            pillItem.querySelector('.pill-item__dosage').textContent = pill.dosage;
            pillItem.querySelector('.pill-item__badge').textContent = scheduleLabel;
            pillItem.querySelector('.pill-item__time').textContent = pill.time || '--:--';
            pillItem.querySelector('.pill-item__desc').textContent = description;

            pillItem.addEventListener('click', () => {
                currentPillId = pill.id;
                drugNameInput.value = pill.drugName;
                dosageInput.value = pill.dosage;
                notifyDailyInput.checked = pill.notifyDaily;
                syncCheckbox();
                toggleDateField(pill.notifyDaily);
                if (!pill.notifyDaily) setDateValue(pill.date || '');
                setTimeValue(pill.time || '');
                descriptionInput.value = pill.description || '';
                setFeedback();
                toggleDeleteButton(true);
                showForm('edit');
                renderPills(allPills);
            });

            pillListContainer.appendChild(pillItem);
        });
    }

    dateTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openDatePicker();
    });
    timeTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        openTimePicker();
    });
    calPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
        renderCalendar();
    });
    calNext.addEventListener('click', (e) => {
        e.stopPropagation();
        calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
        renderCalendar();
    });
    calToday.addEventListener('click', (e) => {
        e.stopPropagation();
        setDateValue(toIsoDate(new Date()));
        closePickers();
    });
    timeApply.addEventListener('click', (e) => {
        e.stopPropagation();
        setTimeValue(`${pad(draftHour)}:${pad(draftMinute)}`);
        closePickers();
    });

    datePopover.addEventListener('click', (e) => e.stopPropagation());
    timePopover.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('click', () => closePickers());

    const formPanel = formView.querySelector('.panel');
    if (formPanel) {
        formPanel.addEventListener('scroll', () => closePickers(), { passive: true });
    }

    if (typeof window.electronAPI?.onPopoverReset === 'function') {
        window.electronAPI.onPopoverReset(() => {
            document.documentElement.classList.remove('has-popover-escape');
            datePicker.classList.remove('is-open');
            timePicker.classList.remove('is-open');
            datePopover.hidden = true;
            timePopover.hidden = true;
            testAlarmMenu.hidden = true;
        });
    }

    addPillsButton.addEventListener('click', () => {
        if (formView.classList.contains('is-active')) closeToList();
        else openCreateForm();
    });
    addPillFooter.addEventListener('click', openCreateForm);
    closeFormButton.addEventListener('click', closeToList);
    cancelFormButton.addEventListener('click', closeToList);

    notifyDailyInput.addEventListener('change', () => {
        syncCheckbox();
        toggleDateField(notifyDailyInput.checked);
    });

    searchInput.addEventListener('input', () => renderPills(allPills));

    saveButton.addEventListener('click', () => {
        const formData = {
            id: currentPillId,
            drugName: drugNameInput.value.trim(),
            dosage: dosageInput.value.trim(),
            date: notifyDailyInput.checked ? null : dateInput.value,
            time: timeInput.value,
            notifyDaily: notifyDailyInput.checked,
            description: descriptionInput.value.trim(),
        };

        if (!formData.drugName || !formData.dosage || !formData.time || (!formData.notifyDaily && !formData.date)) {
            setFeedback('error', 'Пожалуйста, заполните все обязательные поля.');
            return;
        }

        setFeedback();

        if (currentPillId) window.electronAPI.updatePill(formData);
        else window.electronAPI.saveFormData(formData);
    });

    window.electronAPI.onSaveResponse((message) => {
        if (message === 'Данные успешно сохранены!' || message === 'Данные успешно обновлены!') {
            clearForm();
            showList();
            window.electronAPI.getPills();
        } else {
            setFeedback('error', message);
        }
    });

    window.electronAPI.onGetPillsResponse((pills) => {
        allPills = Array.isArray(pills) ? pills : [];
        toolbarSubtitle.textContent = allPills.length
            ? `${allPills.length} в расписании`
            : 'Напоминания о лекарствах';
        renderPills(allPills);
    });
    window.electronAPI.getPills();

    deleteButton.addEventListener('click', () => {
        if (currentPillId) window.electronAPI.deletePill(currentPillId);
    });

    window.electronAPI.onDeletePillResponse((message) => {
        if (message === 'Таблетка успешно удалена!') {
            clearForm();
            showList();
            window.electronAPI.getPills();
        } else {
            setFeedback('error', message);
        }
    });

    document.getElementById('winMinimize').addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.windowMinimize();
    });
    document.getElementById('winMaximize').addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.windowMaximizeToggle();
    });
    document.getElementById('winClose').addEventListener('click', (e) => {
        e.stopPropagation();
        window.electronAPI.windowClose();
    });
    document.getElementById('titlebarDrag').addEventListener('dblclick', () => {
        window.electronAPI.windowMaximizeToggle();
    });

    window.electronAPI.onWindowState((state) => {
        document.documentElement.classList.toggle('is-maximized', Boolean(state.maximized));
    });

    const testAlarmButton = document.getElementById('testAlarm');
    const testAlarmMenu = document.getElementById('testAlarmMenu');
    const testAlarmWrap = document.getElementById('testAlarmWrap');
    const toast = document.getElementById('toast');
    const openSettingsButton = document.getElementById('openSettings');
    const closeSettingsButton = document.getElementById('closeSettings');
    const settingsBackdrop = document.getElementById('settingsBackdrop');
    const settingsPanel = document.getElementById('settingsPanel');
    const themeOptions = document.getElementById('themeOptions');
    const soundPicker = document.getElementById('soundPicker');
    const soundTrigger = document.getElementById('soundTrigger');
    const soundDisplay = document.getElementById('soundDisplay');
    const soundMenu = document.getElementById('soundMenu');
    const soundPreviewBtn = document.getElementById('soundPreviewBtn');
    const soundRemoveBtn = document.getElementById('soundRemoveBtn');
    const settingsPreviewAudio = document.getElementById('settingsPreviewAudio');

    let toastTimer = null;
    let currentSettings = { theme: 'dark', soundId: 'soft-marimba', alertMode: 'both', sounds: [] };
    let isDevBuild = false;
    let soundPreviewing = false;

    async function initDevFeatures() {
        try {
            isDevBuild = typeof window.electronAPI?.isDev === 'function'
                ? Boolean(await window.electronAPI.isDev())
                : false;
        } catch {
            isDevBuild = false;
        }
        if (testAlarmWrap) {
            testAlarmWrap.hidden = !isDevBuild;
        }
    }

    function showToast(message) {
        toast.textContent = message;
        toast.hidden = false;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.hidden = true;
        }, 3200);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
    }

    function openSettings() {
        closePickers();
        closeTestMenu();
        settingsPanel.classList.add('is-open');
        settingsBackdrop.classList.add('is-open');
        settingsPanel.setAttribute('aria-hidden', 'false');
        void refreshAlertStatus();
    }

    function closeSettings() {
        settingsPanel.classList.remove('is-open');
        settingsBackdrop.classList.remove('is-open');
        settingsPanel.setAttribute('aria-hidden', 'true');
        closeSoundPicker();
        stopSoundPreview();
    }

    function stopSoundPreview() {
        settingsPreviewAudio.pause();
        settingsPreviewAudio.currentTime = 0;
        soundPreviewing = false;
        if (soundPreviewBtn) soundPreviewBtn.textContent = 'Слушать';
    }

    function getSelectedSound() {
        const sounds = currentSettings.sounds || [];
        return sounds.find((item) => item.id === currentSettings.soundId) || sounds[0] || null;
    }

    function closeSoundPicker() {
        if (!soundPicker) return;
        soundPicker.classList.remove('is-open');
        if (soundMenu) soundMenu.hidden = true;
        if (soundTrigger) soundTrigger.setAttribute('aria-expanded', 'false');
    }

    function openSoundPicker() {
        if (!soundPicker || !soundMenu || !soundTrigger) return;
        const open = !soundPicker.classList.contains('is-open');
        closeSoundPicker();
        if (!open) return;
        soundPicker.classList.add('is-open');
        soundMenu.hidden = false;
        soundTrigger.setAttribute('aria-expanded', 'true');
    }

    function renderThemeOptions() {
        themeOptions.querySelectorAll('.settings-option').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.theme === currentSettings.theme);
        });
    }

    const alertModeOptions = document.getElementById('alertModeOptions');
    const permissionList = document.getElementById('permissionList');
    const overlayPermHint = document.getElementById('overlayPermHint');
    const overlayPermBtn = document.getElementById('overlayPermBtn');
    const notifyPermHint = document.getElementById('notifyPermHint');
    const notifyPermBtn = document.getElementById('notifyPermBtn');
    const fullscreenPermHint = document.getElementById('fullscreenPermHint');
    const fullscreenPermBtn = document.getElementById('fullscreenPermBtn');
    const batteryPermHint = document.getElementById('batteryPermHint');
    const batteryPermBtn = document.getElementById('batteryPermBtn');

    function renderAlertModeOptions() {
        if (!alertModeOptions) return;
        const mode = currentSettings.alertMode || 'both';
        alertModeOptions.querySelectorAll('.settings-option').forEach((button) => {
            button.classList.toggle('is-active', button.dataset.alertMode === mode);
        });
    }

    function setPermissionRow(button, hint, ok, okText, needText) {
        const row = button?.closest('.permission-row');
        if (!row || !hint) return;
        row.classList.toggle('is-ok', Boolean(ok));
        hint.textContent = ok ? okText : needText;
    }

    async function refreshAlertStatus() {
        if (!permissionList || typeof window.electronAPI?.getAlertStatus !== 'function') return;
        let status = { platform: 'electron', overlay: true, notifications: true, exactAlarms: true, background: true, fullScreenIntent: true };
        try {
            status = await window.electronAPI.getAlertStatus() || status;
        } catch {
            // Desktop stubs still work without this API.
        }
        const isMobile = status.platform === 'android' || document.documentElement.classList.contains('is-mobile');
        permissionList.hidden = !isMobile;
        if (!isMobile) return;

        setPermissionRow(
            overlayPermBtn,
            overlayPermHint,
            status.overlay,
            'Разрешено — окно с подтверждением может открыться поверх приложений',
            'Нужно разрешение, иначе окно с подтверждением не откроется',
        );
        setPermissionRow(
            notifyPermBtn,
            notifyPermHint,
            status.notifications,
            'Разрешено — обычные уведомления придут в шторку',
            'Разрешите уведомления, чтобы не пропустить приём',
        );
        setPermissionRow(
            fullscreenPermBtn,
            fullscreenPermHint,
            status.fullScreenIntent !== false,
            'Разрешено — напоминание откроется поверх блокировки',
            'Разрешите полноэкранные уведомления для экрана блокировки',
        );
        setPermissionRow(
            batteryPermBtn,
            batteryPermHint,
            Boolean(status.exactAlarms && status.background),
            'Фон и точные будильники разрешены',
            'Отключите ограничения батареи и разрешите точные будильники',
        );
    }

    function renderSoundPicker() {
        if (!soundDisplay || !soundMenu) return;
        const selected = getSelectedSound();
        soundDisplay.textContent = selected
            ? (selected.custom ? `${selected.name} (своя)` : selected.name)
            : 'Выберите звук';

        if (soundRemoveBtn) {
            soundRemoveBtn.hidden = !selected?.custom;
        }

        soundMenu.innerHTML = '';
        (currentSettings.sounds || []).forEach((sound) => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = `sound-picker__option${sound.id === currentSettings.soundId ? ' is-active' : ''}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', sound.id === currentSettings.soundId ? 'true' : 'false');

            const name = document.createElement('span');
            name.className = 'sound-picker__option-name';
            name.textContent = sound.custom ? `${sound.name} (своя)` : sound.name;

            const mark = document.createElement('span');
            mark.className = 'sound-picker__option-mark';
            mark.textContent = '✓';

            option.append(name, mark);
            option.addEventListener('click', async () => {
                stopSoundPreview();
                currentSettings = await window.electronAPI.setSettings({ soundId: sound.id });
                renderSoundPicker();
                closeSoundPicker();
                showToast(`Звук: ${sound.name}`);
            });
            soundMenu.appendChild(option);
        });
    }

    function applySettings(settings) {
        currentSettings = settings;
        applyTheme(settings.theme);
        renderThemeOptions();
        renderAlertModeOptions();
        renderSoundPicker();
        void refreshAlertStatus();
    }

    themeOptions.querySelectorAll('.settings-option').forEach((button) => {
        button.addEventListener('click', async () => {
            currentSettings = await window.electronAPI.setSettings({ theme: button.dataset.theme });
            applySettings(currentSettings);
        });
    });

    alertModeOptions?.querySelectorAll('.settings-option').forEach((button) => {
        button.addEventListener('click', async () => {
            currentSettings = await window.electronAPI.setSettings({ alertMode: button.dataset.alertMode });
            applySettings(currentSettings);
            const labels = {
                overlay: 'Только окно с подтверждением',
                notification: 'Только уведомление',
                both: 'Окно и уведомление',
            };
            showToast(labels[button.dataset.alertMode] || 'Способ напоминания сохранён');
        });
    });

    async function requestAlertPermission(kind) {
        if (typeof window.electronAPI?.requestAlertPermission !== 'function') return;
        await window.electronAPI.requestAlertPermission(kind);
        setTimeout(() => {
            void refreshAlertStatus();
        }, 400);
    }

    overlayPermBtn?.addEventListener('click', () => requestAlertPermission('overlay'));
    notifyPermBtn?.addEventListener('click', () => requestAlertPermission('notifications'));
    fullscreenPermBtn?.addEventListener('click', () => requestAlertPermission('fullscreen'));
    batteryPermBtn?.addEventListener('click', () => requestAlertPermission('background'));

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void refreshAlertStatus();
    });

    openSettingsButton.addEventListener('click', openSettings);
    closeSettingsButton.addEventListener('click', closeSettings);
    settingsBackdrop.addEventListener('click', closeSettings);

    soundTrigger?.addEventListener('click', (event) => {
        event.stopPropagation();
        openSoundPicker();
    });

    soundPreviewBtn?.addEventListener('click', async () => {
        const selected = getSelectedSound();
        if (!selected) return;
        if (soundPreviewing) {
            stopSoundPreview();
            return;
        }
        try {
            settingsPreviewAudio.src = selected.src;
            settingsPreviewAudio.volume = 0.28;
            settingsPreviewAudio.currentTime = 0;
            await settingsPreviewAudio.play();
            soundPreviewing = true;
            soundPreviewBtn.textContent = 'Стоп';
        } catch {
            stopSoundPreview();
            showToast('Не удалось воспроизвести звук');
        }
    });

    settingsPreviewAudio?.addEventListener('ended', () => {
        stopSoundPreview();
    });

    soundRemoveBtn?.addEventListener('click', async () => {
        const selected = getSelectedSound();
        if (!selected?.custom) return;
        stopSoundPreview();
        currentSettings = await window.electronAPI.removeCustomSound(selected.id);
        applySettings(currentSettings);
        showToast('Свой звук удалён');
    });

    document.addEventListener('click', (event) => {
        if (!soundPicker?.contains(event.target)) closeSoundPicker();
    });

    const addCustomSoundButton = document.getElementById('addCustomSound');
    addCustomSoundButton.addEventListener('click', async () => {
        stopSoundPreview();
        closeSoundPicker();
        const result = await window.electronAPI.addCustomSound();
        if (result?.error) {
            showToast(result.error);
            return;
        }
        applySettings(result);
        showToast('Музыка добавлена');
    });

    const appVersionEl = document.getElementById('appVersion');
    const updateStatusEl = document.getElementById('updateStatus');
    const updateCheckBtn = document.getElementById('updateCheck');
    const updateDownloadBtn = document.getElementById('updateDownload');
    const updateInstallBtn = document.getElementById('updateInstall');
    let updateStatus = { state: 'idle' };

    function renderUpdateStatus(status) {
        updateStatus = status || { state: 'idle' };
        if (updateStatus.url || updateStatus.version) {
            window.__pillsUpdateLast = {
                ...(window.__pillsUpdateLast || {}),
                url: updateStatus.url || window.__pillsUpdateLast?.url,
                version: updateStatus.version || window.__pillsUpdateLast?.version,
            };
        }
        const isAndroid = document.documentElement.classList.contains('is-mobile');
        updateDownloadBtn.hidden = true;
        updateInstallBtn.hidden = true;
        updateCheckBtn.hidden = false;
        updateCheckBtn.disabled = false;
        updateInstallBtn.textContent = isAndroid ? 'Установить APK' : 'Установить и перезапустить';

        switch (updateStatus.state) {
            case 'checking':
                updateStatusEl.textContent = 'Проверяем обновления…';
                updateCheckBtn.disabled = true;
                break;
            case 'available':
                updateStatusEl.textContent = updateStatus.manual
                    ? `Доступна версия ${updateStatus.version}. На macOS скачайте её вручную с GitHub.`
                    : `Доступна версия ${updateStatus.version}.`;
                updateDownloadBtn.hidden = false;
                updateDownloadBtn.textContent = updateStatus.manual ? 'Открыть Releases' : 'Скачать';
                break;
            case 'not-available':
                updateStatusEl.textContent = `У вас актуальная версия (${updateStatus.version}).`;
                break;
            case 'downloading':
                updateStatusEl.textContent = `Скачивание… ${Math.round(updateStatus.percent || 0)}%`;
                updateCheckBtn.hidden = true;
                break;
            case 'ready':
                updateStatusEl.textContent = isAndroid
                    ? `Версия ${updateStatus.version} скачана. Разрешите установку APK, если система спросит.`
                    : `Версия ${updateStatus.version} скачана. Можно установить.`;
                updateCheckBtn.hidden = true;
                updateInstallBtn.hidden = false;
                break;
            case 'installing':
                updateStatusEl.textContent = 'Открыт установщик Android — подтвердите обновление.';
                updateCheckBtn.hidden = true;
                break;
            case 'unsupported':
                updateStatusEl.textContent = updateStatus.reason === 'portable'
                    ? 'Автообновление недоступно в portable-сборке. Скачайте новую версию с Releases.'
                    : 'Автообновление работает только в установленной сборке.';
                break;
            case 'error': {
                const messages = {
                    macUnsigned: 'На macOS без подписи Apple обновляйтесь через GitHub Releases.',
                    network: 'Не удалось проверить обновления. Проверьте интернет.',
                    notFound: 'Метаданные обновления не найдены в релизе.',
                    checksum: 'Файл обновления повреждён. Попробуйте позже.',
                    permission: isAndroid
                        ? 'Разрешите установку из этого приложения (неизвестные источники), затем снова нажмите «Установить APK».'
                        : 'Нет прав для установки обновления.',
                    generic: 'Ошибка при проверке обновлений.',
                };
                updateStatusEl.textContent = messages[updateStatus.code] || updateStatus.message || messages.generic;
                if (updateStatus.code === 'permission' && isAndroid) {
                    updateInstallBtn.hidden = false;
                }
                break;
            }
            default:
                updateStatusEl.textContent = isAndroid
                    ? 'Можно проверить обновление с GitHub Releases и установить APK.'
                    : 'Можно проверить наличие новой версии.';
                break;
        }
    }

    updateCheckBtn.addEventListener('click', async () => {
        renderUpdateStatus({ state: 'checking' });
        const result = await window.electronAPI.checkForUpdates();
        if (result) renderUpdateStatus(result);
    });

    updateDownloadBtn.addEventListener('click', async () => {
        if (updateStatus.state === 'available' && updateStatus.manual) {
            await window.electronAPI.openReleases();
            return;
        }
        renderUpdateStatus({ state: 'downloading', percent: 0, version: updateStatus.version, url: updateStatus.url });
        const result = await window.electronAPI.downloadUpdate();
        if (result) renderUpdateStatus(result);
    });

    updateInstallBtn.addEventListener('click', async () => {
        const result = await window.electronAPI.installUpdate();
        if (result) renderUpdateStatus(result);
    });

    if (typeof window.electronAPI.onUpdateStatus === 'function') {
        window.electronAPI.onUpdateStatus((status) => renderUpdateStatus(status));
    }

    void window.electronAPI.getAppVersion?.().then((version) => {
        if (appVersionEl && version) appVersionEl.textContent = version;
    }).catch(() => {});

    function collectDrugHistory() {
        const byName = new Map();
        allPills.forEach((pill) => {
            const name = String(pill.drugName || '').trim();
            if (!name) return;
            const key = name.toLowerCase();
            const dosage = String(pill.dosage || '').trim();
            const prev = byName.get(key);
            if (!prev) {
                byName.set(key, {
                    name,
                    dosages: dosage ? [dosage] : [],
                    updatedAt: Number(pill.id) || 0,
                });
                return;
            }
            if (dosage && !prev.dosages.some((item) => item.toLowerCase() === dosage.toLowerCase())) {
                prev.dosages.unshift(dosage);
            }
            prev.updatedAt = Math.max(prev.updatedAt, Number(pill.id) || 0);
            prev.name = name;
        });
        return [...byName.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    }

    function hideSuggestMenus(except) {
        if (except !== 'drug') drugSuggestMenu.hidden = true;
        if (except !== 'dosage') dosageSuggestMenu.hidden = true;
    }

    function renderSuggestMenu(menu, items, onPick) {
        menu.innerHTML = '';
        if (!items.length) {
            menu.hidden = true;
            return;
        }
        items.forEach((item) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'suggest__option';
            button.setAttribute('role', 'option');
            if (item.meta) {
                button.innerHTML = '<span class="suggest__option-title"></span><span class="suggest__option-meta"></span>';
                button.querySelector('.suggest__option-title').textContent = item.label;
                button.querySelector('.suggest__option-meta').textContent = item.meta;
            } else {
                button.textContent = item.label;
            }
            button.addEventListener('mousedown', (e) => {
                e.preventDefault();
                onPick(item);
                menu.hidden = true;
            });
            menu.appendChild(button);
        });
        menu.hidden = false;
    }

    function updateDrugSuggestions() {
        const query = drugNameInput.value.trim().toLowerCase();
        const history = collectDrugHistory();
        const matched = history
            .filter((item) => !query || item.name.toLowerCase().includes(query))
            .slice(0, 8)
            .map((item) => ({
                label: item.name,
                meta: item.dosages[0] || '',
                name: item.name,
                dosage: item.dosages[0] || '',
            }));
        renderSuggestMenu(drugSuggestMenu, matched, (item) => {
            drugNameInput.value = item.name;
            if (item.dosage && !dosageInput.value.trim()) dosageInput.value = item.dosage;
            hideSuggestMenus();
            updateDosageSuggestions();
        });
    }

    function updateDosageSuggestions() {
        const drugQuery = drugNameInput.value.trim().toLowerCase();
        const dosageQuery = dosageInput.value.trim().toLowerCase();
        const history = collectDrugHistory();
        const related = drugQuery
            ? history.filter((item) => (
                item.name.toLowerCase() === drugQuery
                || item.name.toLowerCase().includes(drugQuery)
            ))
            : history;
        const dosages = new Map();
        related.forEach((item) => {
            item.dosages.forEach((dosage) => {
                const key = dosage.toLowerCase();
                if (!dosages.has(key)) dosages.set(key, dosage);
            });
        });
        const matched = [...dosages.values()]
            .filter((dosage) => !dosageQuery || dosage.toLowerCase().includes(dosageQuery))
            .slice(0, 8)
            .map((dosage) => ({ label: dosage, dosage }));
        renderSuggestMenu(dosageSuggestMenu, matched, (item) => {
            dosageInput.value = item.dosage;
            hideSuggestMenus();
        });
    }

    drugNameInput.addEventListener('focus', () => {
        hideSuggestMenus('drug');
        updateDrugSuggestions();
    });
    drugNameInput.addEventListener('input', () => {
        hideSuggestMenus('drug');
        updateDrugSuggestions();
    });
    dosageInput.addEventListener('focus', () => {
        hideSuggestMenus('dosage');
        updateDosageSuggestions();
    });
    dosageInput.addEventListener('input', () => {
        hideSuggestMenus('dosage');
        updateDosageSuggestions();
    });
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#drugSuggest') && !e.target.closest('#dosageSuggest')) {
            hideSuggestMenus();
        }
    });


    function closeTestMenu() {
        if (testAlarmMenu.hidden) return;
        testAlarmMenu.hidden = true;
        if (!datePicker.classList.contains('is-open') && !timePicker.classList.contains('is-open')) {
            void clearPopoverEscape();
        }
    }

    async function placeTestMenu() {
        closePickers();
        await placeFloatingMenu(testAlarmButton, testAlarmMenu, {
            align: 'right',
            gap: 8,
            fallbackWidth: 180,
            fallbackHeight: 160,
        });
    }

    testAlarmButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!isDevBuild) return;
        const willOpen = testAlarmMenu.hidden;
        if (willOpen) await placeTestMenu();
        else closeTestMenu();
    });

    testAlarmMenu.addEventListener('click', (e) => e.stopPropagation());

    testAlarmMenu.querySelectorAll('.test-alarm__option').forEach((option) => {
        option.addEventListener('click', async () => {
            if (!isDevBuild) return;
            const delay = Number(option.dataset.delay) || 0;
            closeTestMenu();
            await window.electronAPI.testAlarm(delay);
            if (delay > 0) {
                const label = delay >= 60 ? `${delay / 60} мин` : `${delay} сек`;
                showToast(`Тест будильника через ${label}`);
                window.electronAPI.windowClose();
            }
        });
    });

    document.addEventListener('click', (e) => {
        if (!testAlarmWrap.contains(e.target)) closeTestMenu();
    });

    window.electronAPI.onSettingsChanged((settings) => {
        applySettings(settings);
    });

    void initDevFeatures();
    void window.electronAPI.getSettings().then(applySettings);

    if (typeof window.electronAPI.onHardwareBack === 'function') {
        window.electronAPI.onHardwareBack(() => {
            if (soundPicker?.classList.contains('is-open')) {
                closeSoundPicker();
                return true;
            }
            if (settingsPanel?.classList.contains('is-open')) {
                closeSettings();
                return true;
            }
            if (datePicker.classList.contains('is-open') || timePicker.classList.contains('is-open')) {
                closePickers();
                return true;
            }
            if (testAlarmMenu && !testAlarmMenu.hidden) {
                closeTestMenu();
                return true;
            }
            if (!listView.classList.contains('is-active')) {
                clearForm();
                showList();
                return true;
            }
            return false;
        });
    }

    renderCalendar();
    renderTimeLists();
    syncDateDisplay();
    syncTimeDisplay();
    syncCheckbox();
    scheduleWindowFit();
    window.addEventListener('resize', scheduleWindowFit);
});
