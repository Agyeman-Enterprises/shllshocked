const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shllshockd', {
  runCommand:  (psFunction, requiresAdmin) => ipcRenderer.invoke('run-command', { psFunction, requiresAdmin }),
  getRegistry: ()           => ipcRenderer.invoke('get-registry'),
  checkAdmin:  ()           => ipcRenderer.invoke('check-admin'),
  isReady:     ()           => ipcRenderer.invoke('ps-ready'),
  onReady:     (cb)         => ipcRenderer.on('ps-ready', cb),
  minimize:    ()           => ipcRenderer.send('window-minimize'),
  maximize:    ()           => ipcRenderer.send('window-maximize'),
  close:       ()           => ipcRenderer.send('window-close'),
})
