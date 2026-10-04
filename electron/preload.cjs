const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deviceHardware', {
  getSnapshot: () => ipcRenderer.invoke('device:get-hardware-snapshot'),
});