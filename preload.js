const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveFormData: (data) => ipcRenderer.send('save-form-data', data),
    getPills: () => ipcRenderer.send('get-pills'),
    updatePill: (data) => ipcRenderer.send('updatePill', data),
    deletePill: (id) => ipcRenderer.send('deletePill', id),
    onGetPillsResponse: (callback) => ipcRenderer.on('get-pills-response', (event, pills) => callback(pills)),
    onSaveResponse: (callback) => ipcRenderer.on('save-form-data-response', (event, message) => callback(message)),
    onDeletePillResponse: (callback) => ipcRenderer.on('delete-pill-response', (event, message) => callback(message)),
});
