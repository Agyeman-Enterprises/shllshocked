const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('shllshockd', {
  runCommand:         (psFunction, requiresAdmin) => ipcRenderer.invoke('run-command', { psFunction, requiresAdmin }),
  getRegistry:        ()           => ipcRenderer.invoke('get-registry'),
  checkAdmin:         ()           => ipcRenderer.invoke('check-admin'),
  isReady:            ()           => ipcRenderer.invoke('ps-ready'),
  onReady:            (cb)         => ipcRenderer.on('ps-ready', cb),
  minimize:           ()           => ipcRenderer.send('window-minimize'),
  maximize:           ()           => ipcRenderer.send('window-maximize'),
  close:              ()           => ipcRenderer.send('window-close'),
  loadSubmissions:    ()           => ipcRenderer.invoke('load-submissions'),
  saveSubmission:     (submission) => ipcRenderer.invoke('save-submission', submission),
  upvoteSubmission:   (id)         => ipcRenderer.invoke('upvote-submission', id),
  flagSubmission:     (id)         => ipcRenderer.invoke('flag-submission', id),
  approveSubmission:  (id)         => ipcRenderer.invoke('approve-submission', id),
  getLicenseStatus:   ()           => ipcRenderer.invoke('get-license-status'),
  validateLicense:    (lic, email) => ipcRenderer.invoke('validate-license', { licenseKey: lic, email }),
  activateLicense:    (lic, email) => ipcRenderer.invoke('activate-license', { licenseKey: lic, email }),
  deactivateLicense:  ()           => ipcRenderer.invoke('deactivate-license'),
  generateLicenseKey: (email)      => ipcRenderer.invoke('generate-license-key', email),
})
