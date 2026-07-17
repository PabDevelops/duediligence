const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widgetAPI', {
  onStatsUpdate: (callback) => {
    ipcRenderer.on('stats-update', (_event, payload) => callback(payload));
  },
  closeApp: () => ipcRenderer.invoke('close-app'),
  hideWindow: () => ipcRenderer.invoke('hide-window'),
});
