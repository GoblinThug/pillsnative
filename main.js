const { app, BrowserWindow, Notification, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

let mainWindow = null;
let tray = null;

// Создание главного окна
const createWindow = () => {
    mainWindow = new BrowserWindow({
        minWidth: 400,
        minHeight: 650,
        width: 400,
        height: 650,
        autoHideMenuBar: true,
        title: "Главное окно",
        icon: path.join(__dirname, 'assets/img/icon.png'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
        },
    });

    mainWindow.loadFile(path.join(__dirname, 'html/index.html'));

    // Сворачивание вместо закрытия
    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault(); // Предотвращаем полное закрытие
            mainWindow.hide(); // Скрываем окно
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
};

// Создание иконки в системном трее
const createTray = () => {
    tray = new Tray(path.join(__dirname, 'assets/img/icon.png')); // Путь к иконке

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Открыть',
            click: () => {
                mainWindow.show(); // Показываем главное окно
            },
        },
        {
            label: 'Выход',
            click: () => {
                app.isQuiting = true; // Флаг для выхода из приложения
                app.quit(); // Закрываем приложение
            },
        },
    ]);

    tray.setToolTip('PillsNative'); // Подсказка при наведении на иконку
    tray.setContextMenu(contextMenu); // Добавляем контекстное меню

    // Обработка двойного клика по иконке в трее
    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                mainWindow.hide(); // Скрываем окно, если оно уже видимо
            } else {
                mainWindow.show(); // Показываем окно
            }
        }
    });
};

// Настройка уведомлений
function scheduleNotification(pill) {
    if (!pill.notifyDaily && !pill.date) return; // Пропускаем, если нет даты и не установлено ежедневное уведомление

    const notificationTime = new Date();
    if (pill.notifyDaily) {
        notificationTime.setHours(pill.time.split(':')[0], pill.time.split(':')[1], 0);
    } else {
        notificationTime.setFullYear(
            pill.date.split('-')[0],
            pill.date.split('-')[1] - 1,
            pill.date.split('-')[2]
        );
        notificationTime.setHours(pill.time.split(':')[0], pill.time.split(':')[1], 0);
    }

    if (notificationTime <= new Date()) {
        notificationTime.setDate(notificationTime.getDate() + 1); // Если время уже прошло, планируем на следующий день
    }

    const job = schedule.scheduleJob(notificationTime, () => {
        const notification = new Notification({
            title: `Время выпить ${pill.drugName}`,
            body: `Принять ${pill.dosage}`,
            silent: false,
        });

        // При клике на уведомление показываем главное окно
        notification.on('click', () => {
            mainWindow.show();
        });
    });

    // Для ежедневных уведомлений создаём повторяющуюся задачу
    if (pill.notifyDaily) {
        const rule = new schedule.RecurrenceRule();
        rule.hour = pill.time.split(':')[0];
        rule.minute = pill.time.split(':')[1];
        schedule.scheduleJob(rule, () => {
            const notification = new Notification({
                title: `Время выпить ${pill.drugName}`,
                body: `Принять ${pill.dosage}`,
                silent: false,
            });

            // При клике на уведомление показываем главное окно
            notification.on('click', () => {
                mainWindow.show();
            });
        });
    }
}

// Сохранение данных формы
ipcMain.on('save-form-data', (event, formData) => {
    const filePath = path.join(app.getPath('documents'), 'pills.json');
    let currentData = [];

    formData.id = Date.now(); // Генерация уникального ID
    if (fs.existsSync(filePath)) {
        currentData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    currentData.push(formData);
    fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));

    // Планируем уведомление
    scheduleNotification(formData);

    event.reply('save-form-data-response', 'Данные успешно сохранены!');
    event.reply('get-pills-response', currentData);
});

// Обновление таблетки
ipcMain.on('updatePill', (event, updatedPill) => {
    const filePath = path.join(app.getPath('documents'), 'pills.json');
    let currentData = [];
    if (fs.existsSync(filePath)) {
        currentData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    const index = currentData.findIndex(pill => pill.id === updatedPill.id);
    if (index !== -1) {
        currentData[index] = updatedPill;
        fs.writeFileSync(filePath, JSON.stringify(currentData, null, 2));

        // Планируем уведомление
        scheduleNotification(updatedPill);
    }
    event.reply('save-form-data-response', 'Данные успешно обновлены!');
    event.reply('get-pills-response', currentData);
});

// Получение списка таблеток
ipcMain.on('get-pills', (event) => {
    const filePath = path.join(app.getPath('documents'), 'pills.json');
    if (fs.existsSync(filePath)) {
        const currentData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        event.reply('get-pills-response', currentData);

        // Планируем все существующие уведомления
        currentData.forEach(pill => scheduleNotification(pill));
    } else {
        event.reply('get-pills-response', []);
    }
});

// Удаление таблетки
ipcMain.on('deletePill', (event, pillId) => {
    const filePath = path.join(app.getPath('documents'), 'pills.json');
    let currentData = [];
    if (fs.existsSync(filePath)) {
        currentData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    const updatedData = currentData.filter(pill => pill.id !== pillId);
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
    event.reply('get-pills-response', updatedData);
    event.reply('delete-pill-response', 'Таблетка успешно удалена!');
});

// Инициализация приложения
app.whenReady().then(() => {
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Обработка закрытия всех окон
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit(); // Закрываем приложение на Windows/Linux
    }
});