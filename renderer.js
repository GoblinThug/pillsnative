document.addEventListener('DOMContentLoaded', () => {
    const addPillsButton = document.getElementById('toggleForm');
    const saveButton = document.getElementById('save');
    const deleteButton = document.getElementById('delete');
    const successMessage = document.getElementById('success');
    const errorMessage = document.getElementById('error');
    const drugNameInput = document.getElementById('drugName');
    const dosageInput = document.getElementById('dosage');
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const notifyDailyInput = document.getElementById('notifyDaily');
    const descriptionInput = document.getElementById('description');
    const addPillsForm = document.getElementById('addPillsForm');
    const pillListContainer = document.querySelector('.pill-list');
    let currentPillId = null;

    // Управление видимостью поля даты
    function toggleDateField(hide) {
        if (hide) {
            dateInput.classList.add('hidden'); // Скрываем поле даты
            dateInput.value = ''; // Очищаем значение поля даты
        } else {
            dateInput.classList.remove('hidden'); // Показываем поле даты
        }
    }

    // Переключение между списком таблеток и формой добавления
    addPillsButton.addEventListener('click', () => {
        const isFormVisible = addPillsForm.classList.contains('hidden');
        addPillsForm.classList.toggle('hidden', !isFormVisible);
        pillListContainer.classList.toggle('hidden', isFormVisible);

        if (isFormVisible) {
            addPillsButton.textContent = 'Назад';
            addPillsButton.classList.remove('bg-[#2165CC]');
            addPillsButton.classList.add('bg-gray-500');
            clearForm();
            toggleDeleteButton(false);
        } else {
            addPillsButton.textContent = 'Добавить новый приём';
            addPillsButton.classList.remove('bg-gray-500');
            addPillsButton.classList.add('bg-[#2165CC]');
        }
    });

    // Обработчик изменения чекбокса "Присылать уведомления каждый день"
    notifyDailyInput.addEventListener('change', () => {
        toggleDateField(notifyDailyInput.checked);
    });

    // Сохранение данных формы
    saveButton.addEventListener('click', () => {
        const formData = {
            id: currentPillId,
            drugName: drugNameInput.value.trim(),
            dosage: dosageInput.value.trim(),
            date: notifyDailyInput.checked ? null : dateInput.value, // Дата не записывается, если notifyDaily = true
            time: timeInput.value,
            notifyDaily: notifyDailyInput.checked,
            description: descriptionInput.value.trim(),
        };

        if (!formData.drugName || !formData.dosage || !formData.time || (!formData.notifyDaily && !formData.date)) {
            errorMessage.textContent = 'Пожалуйста, заполните все обязательные поля.';
            successMessage.textContent = '';
            return;
        }

        errorMessage.textContent = '';
        successMessage.textContent = '';

        if (currentPillId) {
            window.electronAPI.updatePill(formData); // Обновляем существующую таблетку
        } else {
            window.electronAPI.saveFormData(formData); // Добавляем новую таблетку
        }
    });

    // Обработка ответа после сохранения данных
    window.electronAPI.onSaveResponse((message) => {
        if (message === 'Данные успешно сохранены!' || message === 'Данные успешно обновлены!') {
            successMessage.textContent = message;
            errorMessage.textContent = '';
            clearForm();
            pillListContainer.classList.remove('hidden');
            addPillsForm.classList.add('hidden');
            addPillsButton.textContent = 'Добавить новый приём';
            addPillsButton.classList.remove('bg-gray-500');
            addPillsButton.classList.add('bg-[#2165CC]');
            window.electronAPI.getPills(); // Загружаем обновленный список
        } else {
            errorMessage.textContent = message;
            successMessage.textContent = '';
        }
    });

    // Получение данных таблеток
    window.electronAPI.getPills();
    window.electronAPI.onGetPillsResponse((pills) => {
        pillListContainer.innerHTML = '';
        pills.forEach(pill => {
            const pillItem = document.createElement('div');
            pillItem.classList.add(
                'pill-item',
                'grid',
                'grid-cols-2',
                'border',
                'border-[#373B40]',
                'p-[10px]',
                'items-center',
                'hover:border-[#2165CC]',
                'cursor-pointer',
                'transition-all',
                'duration-200'
            );
            pillItem.innerHTML = `
                <div class="flex flex-col">
                    <p class="text-white font-[Product Sans]">${pill.drugName}</p>
                    <p class="text-white font-[Product Sans]">${pill.dosage}</p>
                </div>
                <div class="flex flex-col items-end">
                    <p class="text-[#373B40] text-[14px] font-[Product Sans] font-bold">${pill.notifyDaily ? 'Каждый день' : pill.date}</p>
                    <p class="text-[#373B40] text-[14px] font-[Product Sans] font-bold">${pill.time}</p>
                </div>
                <p class="text-[#373B40]">${pill.description || 'Без описания'}</p>
            `;
            pillItem.addEventListener('click', () => {
                currentPillId = pill.id;
                drugNameInput.value = pill.drugName;
                dosageInput.value = pill.dosage;
                notifyDailyInput.checked = pill.notifyDaily;
                toggleDateField(pill.notifyDaily); // Скрываем/показываем поле даты
                if (!pill.notifyDaily) dateInput.value = pill.date; // Восстанавливаем дату, если notifyDaily = false
                timeInput.value = pill.time;
                descriptionInput.value = pill.description;
                addPillsForm.classList.remove('hidden');
                pillListContainer.classList.add('hidden');
                addPillsButton.textContent = 'Назад';
                addPillsButton.classList.remove('bg-[#2165CC]');
                addPillsButton.classList.add('bg-gray-500');
                toggleDeleteButton(true);
            });
            pillListContainer.appendChild(pillItem);
        });
    });

    // Очистка формы
    function clearForm() {
        drugNameInput.value = '';
        dosageInput.value = '';
        dateInput.value = '';
        timeInput.value = '';
        notifyDailyInput.checked = false;
        descriptionInput.value = '';
        toggleDateField(false); // Показываем поле даты по умолчанию
        document.querySelector('#error').innerHTML = '';
        document.querySelector('#success').innerHTML = '';
        currentPillId = null;
        toggleDeleteButton(false);
    }

    // Показывать/скрывать кнопку "Удалить"
    function toggleDeleteButton(show) {
        if (show) {
            deleteButton.classList.remove('hidden');
        } else {
            deleteButton.classList.add('hidden');
        }
    }

    // Удаление приёма
    deleteButton.addEventListener('click', () => {
        if (currentPillId) {
            window.electronAPI.deletePill(currentPillId); // Удаляем таблетку
        }
    });

    // Обработка ответа после удаления таблетки
    window.electronAPI.onDeletePillResponse((message) => {
        if (message === 'Таблетка успешно удалена!') {
            successMessage.textContent = message;
            errorMessage.textContent = '';
            clearForm();
            pillListContainer.classList.remove('hidden');
            addPillsForm.classList.add('hidden');
            addPillsButton.textContent = 'Добавить новый приём';
            addPillsButton.classList.remove('bg-gray-500');
            addPillsButton.classList.add('bg-[#2165CC]');
            window.electronAPI.getPills(); // Загружаем обновленный список
        } else {
            errorMessage.textContent = message;
            successMessage.textContent = '';
        }
    });
});