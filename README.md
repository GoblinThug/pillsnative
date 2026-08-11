<p align="center">
  <img src="assets/img/icon.png" alt="PillsNative" width="96" height="96" />
</p>

<h1 align="center">PillsNative</h1>

<p align="center">
  <strong>Напоминания о лекарствах</strong> для Windows, macOS, Linux и Android<br />
  Расписание · уведомления · будильник · свои звуки
</p>

<p align="center">
  <a href="#-русский">Русский</a> · <a href="#-english">English</a>
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/pillsnative/releases/latest"><img src="https://img.shields.io/github/v/release/GoblinThug/pillsnative?style=for-the-badge&label=Release&color=2ea44f" alt="Release" /></a>
  <a href="https://github.com/GoblinThug/pillsnative/releases"><img src="https://img.shields.io/github/downloads/GoblinThug/pillsnative/total?style=for-the-badge&label=Downloads&color=0969da" alt="Downloads" /></a>
  <a href="https://github.com/GoblinThug/pillsnative"><img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android-111827?style=for-the-badge&logo=electron&logoColor=white" alt="Platform" /></a>
  <a href="https://github.com/GoblinThug/pillsnative"><img src="https://img.shields.io/badge/Stack-Electron%20%2B%20Capacitor-0f172a?style=for-the-badge&logo=electron&logoColor=white" alt="Stack" /></a>
</p>

<p align="center">
  <a href="https://github.com/GoblinThug/pillsnative/releases/latest"><strong>⬇️ Скачать последнюю версию</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/GoblinThug/pillsnative/issues">🐞 Сообщить о проблеме</a>
</p>

---

# 🇷🇺 Русский

## ✨ Что это

**PillsNative** — локальное приложение-напоминалка о приёме лекарств: список приёмов, дата и время, ежедневный режим, отдельное окно будильника со звуком и подтверждением.

| | Возможность |
|---|---|
| 💊 | Список приёмов с поиском |
| ⏰ | Разовые и ежедневные напоминания |
| 🔔 | Окно будильника поверх других окон + системный toast |
| 🔊 | Готовые мягкие сигналы и загрузка своей музыки |
| 📝 | Подсказки по уже использованным препаратам и дозировкам |
| 🎨 | Тёмная / светлая тема |
| 📥 | Трей: свернуть в фон и не потерять расписание |
| 📱 | Сборка для Android (Capacitor) |

Текущая версия в репозитории: **`2.0.1`** (актуальный номер всегда в [Releases](https://github.com/GoblinThug/pillsnative/releases)).

---

## ⬇️ Скачать и установить

Готовые сборки: **[GitHub Releases →](https://github.com/GoblinThug/pillsnative/releases)**

### 🪟 Windows

| Файл | Когда брать |
|---|---|
| `PillsNative-Setup-….exe` | Обычная установка — **рекомендуется**, есть автообновление |
| `PillsNative-Portable-….exe` | Без установки; обновлять вручную с Releases |

1. Скачайте installer или zip.
2. Запустите установщик или распакуйте архив.
3. Откройте PillsNative.

> ⚠️ Windows может показать **SmartScreen**. Если доверяете сборке с GitHub: **Подробнее** → **Выполнить в любом случае**.

### 🍎 macOS

| Файл | Когда брать |
|---|---|
| `PillsNative-….dmg` | Установка через образ |
| `…-darwin-….zip` | Архив приложения |

1. Скачайте `.dmg` (или zip) под свою архитектуру.
2. Откройте образ и перетащите приложение в **Программы**.
3. Запустите PillsNative.

> ⚠️ Сборка **не подписана** Apple Developer ID. Сообщение «приложение повреждено» — это Gatekeeper.  
> **ПКМ** по приложению → **Открыть** → снова **Открыть**,  
> либо в Terminal:
>
> ```bash
> xattr -cr /Applications/Pills\ Native.app
> ```

### 🐧 Linux

| Файл | Когда брать |
|---|---|
| `PillsNative-…-x64.AppImage` | Универсальный запуск — **рекомендуется**, есть автообновление |
| `PillsNative-…-x64.deb` | Установка в Debian / Ubuntu |

**AppImage**

```bash
chmod +x PillsNative-*-x64.AppImage
./PillsNative-*-x64.AppImage
```

**deb**

```bash
sudo apt install ./PillsNative-*-x64.deb
# или
sudo dpkg -i PillsNative-*-x64.deb
```

### 🤖 Android

| Файл | Когда брать |
|---|---|
| `PillsNative-android-….apk` | Установка на телефон / эмулятор |

1. Скачайте APK с Releases.
2. Разрешите установку из неизвестных источников (если система попросит).
3. Установите и откройте PillsNative.

> Debug-сборка из CI не подписана Play Store ключом — для личного использования это нормально.

---

## 🚀 Быстрый старт

1. Откройте PillsNative.
2. Нажмите **Добавить приём**.
3. Укажите препарат, дозировку, дату/время (или включите «каждый день»).
4. Сохраните — приложение напомнит в нужный момент.
5. При срабатывании: **Выпил таблетку** или **Отложить 5 мин**.

Данные хранятся локально в Документах (`pills.json`, `pills-settings.json`).

---

## 📚 Основные возможности

### 💊 Приёмы

- Список с поиском по названию, дозировке и описанию
- Разовое напоминание по дате и времени
- Режим «уведомлять каждый день»
- Редактирование и удаление
- Подстановка ранее использованных препаратов и дозировок

### 🔔 Будильник

- Отдельное окно подтверждения поверх остальных
- Звук до закрытия окна
- Отложить на 5 минут
- Системное уведомление (toast)

### 🔊 Звуки

- Набор мягких коротких сигналов
- Загрузка своей музыки (mp3 / wav / ogg / m4a и др.)
- Предпросмотр в настройках

### ⚙️ Настройки

- Тема: тёмная / светлая
- Выбор звука будильника
- Управление своими загруженными треками

---

## ⬆️ Обновления

### Windows

Установленная версия (**не** Portable) проверяет обновления при запуске и из **Настроек**.

1. Появится статус о новой версии.
2. Скачайте обновление в настройках и установите (перезапуск).

Portable обновляется только вручную с [Releases](https://github.com/GoblinThug/pillsnative/releases).

### macOS

Автоустановка через ShipIt **недоступна** (сборка без подписи Apple).  
При новой версии приложение предложит открыть **GitHub Releases** — скачайте новый `.dmg` и замените приложение в **Программах**.

### Linux

**AppImage** проверяет обновления при запуске и из **Настроек** (нужен `latest-linux.yml` в релизе).  
**.deb** — обновляйте вручную с [Releases](https://github.com/GoblinThug/pillsnative/releases).

---

## 🔐 Данные и приватность

- Расписание и настройки хранятся **только локально** на устройстве.
- Нет облачной синхронизации и аккаунтов.
- Свои звуки копируются в `Documents/pills-custom-sounds`.

---

## 🛟 Проблемы?

| Ситуация | Что сделать |
|---|---|
| Не пришло напоминание | Проверьте дату/время, ежедневный режим и что приложение не завершено принудительно |
| Нет звука | Выберите другой сигнал в настройках или загрузите свой файл |
| На Mac «повреждено» | ПКМ → Открыть или `xattr -cr` для `.app` |
| SmartScreen (Win) | Подробнее → Выполнить в любом случае |
| Android не ставит APK | Разрешите установку из неизвестных источников |
| Нет уведомлений (Android) | Разрешите уведомления при первом запуске; не запрещайте автозапуск / точные будильники в настройках батареи |
| Вопросы и баги | [Issues](https://github.com/GoblinThug/pillsnative/issues) |

---

## 🛠️ Для разработчиков

```bash
git clone https://github.com/GoblinThug/pillsnative.git
cd pillsnative
npm install
npx electron .
# или
npm start
```

Локальная сборка:

```bash
npm run dist:win       # Windows → release/
npm run dist:mac       # macOS (нужен Mac)
npm run dist:linux     # Linux → AppImage + deb
npm run mobile:prepare # веб-ассеты для Capacitor
```

### Релиз через GitHub Actions

Workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) собирает **Windows, macOS, Linux и Android** через **electron-builder** и публикует GitHub Release.

1. Поднимите `version` в `package.json`.
2. Закоммитьте и запушьте в `main`.
3. Actions → **Release** создаст тег `vX.Y.Z` (если нужно) и релиз **`PillsNative X.Y.Z`**, затем зальёт артефакты (`latest.yml`, `latest-mac.yml`, `latest-linux.yml`, Setup/Portable, DMG/ZIP, AppImage/deb, APK).

Пуш тега `v*` или ручной **Run workflow** тоже запускают публикацию.

> Каждый пуш в `main` публикует релиз для **текущей** версии из `package.json`.  
> Чтобы вышла новая версия — сначала измените `version`, потом пуш.

---

# 🇬🇧 English

## ✨ What it is

**PillsNative** is a local medication reminder for **Windows**, **macOS**, **Linux**, and **Android**: schedules, tray presence, an always-on-top alarm window, and custom sounds.

| | Feature |
|---|---|
| 💊 | Dose list with search |
| ⏰ | One-shot and daily reminders |
| 🔔 | Alarm window + system toast |
| 🔊 | Soft built-in chimes and custom music upload |
| 📝 | Suggestions for previously used drugs/dosages |
| 🎨 | Dark / light theme |
| 📥 | System tray background mode |
| 📱 | Android build via Capacitor |

Repo version: **`2.0.1`** (always check [Releases](https://github.com/GoblinThug/pillsnative/releases) for the latest).

---

## ⬇️ Download & install

Prebuilt packages: **[GitHub Releases →](https://github.com/GoblinThug/pillsnative/releases)**

### 🪟 Windows

| File | Use when |
|---|---|
| Squirrel / Setup `.exe` | Normal install — **recommended** |
| `…-win32-…zip` | Portable archive |

> ⚠️ SmartScreen may warn. If you trust the GitHub build: **More info** → **Run anyway**.

### 🍎 macOS

| File | Use when |
|---|---|
| `.dmg` | Install via disk image |
| `…-darwin-….zip` | App archive |

> ⚠️ Builds are **not** Apple Developer ID signed. Use **Right-click → Open** or `xattr -cr` on the `.app`.

### 🐧 Linux

| File | Use when |
|---|---|
| `.deb` | Debian / Ubuntu |
| `.rpm` | Fedora / openSUSE |
| `…-linux-….zip` | Portable archive |

### 🤖 Android

| File | Use when |
|---|---|
| `PillsNative-android-….apk` | Sideload install |

---

## 🚀 Quick start

1. Open PillsNative.
2. Tap **Add dose**.
3. Fill drug, dosage, date/time (or enable daily).
4. Save — you’ll get reminded on time.
5. On alarm: **Taken** or **Snooze 5 min**.

Data stays local in Documents (`pills.json`, `pills-settings.json`).

---

## 📚 Main features

- Dose CRUD with search
- Daily or one-shot schedules
- Alarm confirmation window with looping sound
- Built-in soft sounds + custom uploads
- Autocomplete from previous drugs/dosages
- Dark / light theme
- Tray hide/restore

---

## 🔐 Privacy

- Everything is stored **locally**.
- No accounts, no cloud sync.
- Custom sounds live under `Documents/pills-custom-sounds`.

---

## 🛟 Troubleshooting

| Issue | What to try |
|---|---|
| Missed reminder | Check schedule; keep the app running (tray is fine) |
| No sound | Pick another chime or upload your own |
| macOS “damaged” | Right-click → Open / `xattr -cr` |
| Windows SmartScreen | More info → Run anyway |
| Android install blocked | Allow unknown sources |
| Bugs | [Issues](https://github.com/GoblinThug/pillsnative/issues) |

---

## 🛠️ For developers

```bash
git clone https://github.com/GoblinThug/pillsnative.git
cd pillsnative
npm install
npx electron .
```

Local build:

```bash
npm run make
npm run mobile:prepare
```

### Release via GitHub Actions

[`.github/workflows/release.yml`](.github/workflows/release.yml) builds **Windows + macOS + Linux + Android** and publishes a GitHub Release titled **`PillsNative X.Y.Z`**.

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Actions creates tag `vX.Y.Z` if needed and uploads artifacts.

> Every push to `main` publishes for the **current** `package.json` version — bump `version` before pushing when you want a new release number.

---

<p align="center">
  <img src="assets/img/icon.png" alt="" width="40" height="40" /><br />
  <strong>PillsNative</strong> · by Goblin_Thug<br />
  <a href="https://github.com/GoblinThug/pillsnative/releases">Downloads</a>
  ·
  <a href="https://github.com/GoblinThug/pillsnative">GitHub</a>
  ·
  <a href="https://github.com/GoblinThug/pillsnative/issues">Issues</a>
</p>
