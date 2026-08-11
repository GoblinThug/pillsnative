const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const RELEASES_URL = 'https://github.com/GoblinThug/pillsnative/releases/latest';

function isMacUnsignedUpdates() {
    return process.platform === 'darwin';
}

function isPortableBuild() {
    return Boolean(
        process.env.PORTABLE_EXECUTABLE_DIR
        || process.env.PORTABLE_EXECUTABLE_FILE
    );
}

function emit(status) {
    for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('update:status', status);
    }
}

function classifyUpdateError(error) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const lower = message.toLowerCase();

    if (/code signature|shipit|code resources|mac_unsigned/i.test(message)) {
        return 'macUnsigned';
    }
    if (/enoent|404|cannot find|latest\.yml|latest-mac\.yml|no published versions|is not available/i.test(lower)) {
        return 'notFound';
    }
    if (/sha512|checksum|hash|blockmap|corrupt|damaged/i.test(lower)) {
        return 'checksum';
    }
    if (/eacces|eperm|ebusy|operation not permitted/i.test(lower)) {
        return 'permission';
    }
    if (/enotfound|econnrefused|econnreset|etimedout|enetunreach|offline|network|getaddrinfo|socket|tls|certificate|http.?error|status code|net::/i.test(lower)) {
        return 'network';
    }
    return 'generic';
}

function emitUpdateError(error, opts = {}) {
    const code = classifyUpdateError(error);
    const raw = error instanceof Error ? error.message : String(error ?? '');
    console.error('[updater]', code, raw);

    if (opts.quiet && (code === 'network' || code === 'notFound')) {
        emit({ state: 'idle' });
        return code;
    }

    emit({ state: 'error', code });
    return code;
}

function initAutoUpdater() {
    let checkSource = 'auto';

    ipcMain.handle('update:getVersion', () => app.getVersion());

    ipcMain.handle('update:check', async () => {
        if (!app.isPackaged) {
            const status = { state: 'unsupported', reason: 'dev' };
            emit(status);
            return status;
        }
        if (isPortableBuild()) {
            const status = { state: 'unsupported', reason: 'portable' };
            emit(status);
            return status;
        }

        checkSource = 'user';
        emit({ state: 'checking' });
        try {
            await autoUpdater.checkForUpdates();
            return null;
        } catch (error) {
            const code = emitUpdateError(error, { quiet: false });
            return { state: 'error', code };
        }
    });

    ipcMain.handle('update:download', async () => {
        if (isMacUnsignedUpdates()) {
            await shell.openExternal(RELEASES_URL);
            return false;
        }
        try {
            await autoUpdater.downloadUpdate();
            return true;
        } catch (error) {
            emitUpdateError(error);
            return false;
        }
    });

    ipcMain.handle('update:install', () => {
        if (isMacUnsignedUpdates()) {
            void shell.openExternal(RELEASES_URL);
            return;
        }
        autoUpdater.quitAndInstall(false, true);
    });

    ipcMain.handle('update:openReleases', () => shell.openExternal(RELEASES_URL));

    if (!app.isPackaged || isPortableBuild()) {
        return;
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = !isMacUnsignedUpdates();
    autoUpdater.forceDevUpdateConfig = false;
    autoUpdater.allowDowngrade = false;

    if (typeof autoUpdater.verifyUpdateCodeSignature === 'boolean') {
        autoUpdater.verifyUpdateCodeSignature = false;
    }

    autoUpdater.on('checking-for-update', () => {
        emit({ state: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        emit({
            state: 'available',
            version: info.version,
            releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
            manual: isMacUnsignedUpdates(),
        });
    });

    autoUpdater.on('update-not-available', () => {
        emit({ state: 'not-available', version: app.getVersion() });
    });

    autoUpdater.on('download-progress', (progress) => {
        emit({
            state: 'downloading',
            percent: progress.percent,
            transferred: progress.transferred,
            total: progress.total,
        });
    });

    autoUpdater.on('update-downloaded', (info) => {
        emit({ state: 'ready', version: info.version });
    });

    autoUpdater.on('error', (error) => {
        emitUpdateError(error, { quiet: checkSource === 'auto' });
        checkSource = 'auto';
    });

    setTimeout(() => {
        checkSource = 'auto';
        void autoUpdater.checkForUpdates().catch((error) => {
            emitUpdateError(error, { quiet: true });
            checkSource = 'auto';
        });
    }, 4000);
}

module.exports = { initAutoUpdater };
