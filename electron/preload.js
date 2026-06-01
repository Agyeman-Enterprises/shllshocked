const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shllshockd', {
  runCommand: (psFunction) => ipcRenderer.invoke('run-command', psFunction),
  getRegistry: () => ipcRenderer.invoke('get-registry'),
  checkAdmin: () => ipcRenderer.invoke('check-admin'),

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
})
