const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const REGISTRY_PATH = 'C:\\dev\\SHLLSHOCKD\\registry.json'
const PSM1_PATH = 'C:\\dev\\SHLLSHOCKD\\SHLLSHOCKD.psm1'
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// IPC: minimize / maximize / close (custom titlebar)
ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return
  if (mainWindow.isMaximized()) mainWindow.unmaximize()
  else mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow && mainWindow.close())

// IPC: read registry
ipcMain.handle('get-registry', async () => {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      return { error: `registry.json not found at ${REGISTRY_PATH}`, commands: [] }
    }
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    return { commands: Array.isArray(parsed) ? parsed : parsed.commands || [] }
  } catch (err) {
    return { error: err.message, commands: [] }
  }
})

// IPC: check admin
ipcMain.handle('check-admin', async () => {
  return new Promise((resolve) => {
    const script = `[bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`
    const proc = spawn('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true,
    })
    let stdout = ''
    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.on('close', () => {
      resolve(stdout.trim().toLowerCase() === 'true')
    })
    proc.on('error', () => resolve(false))
  })
})

// IPC: run a PowerShell command from the registry
ipcMain.handle('run-command', async (event, psFunction) => {
  return new Promise((resolve) => {
    const hasPsm1 = fs.existsSync(PSM1_PATH)

    let script
    if (hasPsm1) {
      // Import the module, then call the exported function
      script = `
        try {
          Import-Module '${PSM1_PATH.replace(/\\/g, '\\\\')}' -Force -ErrorAction Stop
          ${psFunction}
          exit 0
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `
    } else {
      // No psm1 — run the function name as a raw command (best-effort)
      script = `
        try {
          ${psFunction}
          exit 0
        } catch {
          Write-Error $_.Exception.Message
          exit 1
        }
      `
    }

    const proc = spawn(
      'pwsh',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { windowsHide: true }
    )

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('close', (code) => {
      resolve({
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        success: code === 0,
      })
    })

    proc.on('error', (err) => {
      resolve({
        stdout: '',
        stderr: err.message,
        exitCode: -1,
        success: false,
      })
    })
  })
})
