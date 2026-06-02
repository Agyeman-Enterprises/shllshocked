const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const REGISTRY_PATH = 'C:\\dev\\shllshocked-ps\\registry.json'
const PSM1_PATH    = 'C:\\dev\\shllshocked-ps\\SHLLSHOCKD.psm1'
const isDev        = process.env.NODE_ENV === 'development' || !app.isPackaged

// ─── Persistent PowerShell session ───────────────────────────────────────────
// One long-lived pwsh process loads the module once. Every click is just
// a stdin write + stdout read — no cold start per command.

let psSession = null
let psReady   = false
let psBuffer  = ''
const SENTINEL = '__SHLLSHOCKD_DONE__'

function startPSSession() {
  psSession = spawn('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-NoExit', '-Command', '-'], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  })

  psSession.stdout.on('data', (data) => {
    psBuffer += data.toString()
  })

  psSession.stderr.on('data', () => {})

  psSession.on('close', () => {
    psSession = null
    psReady   = false
    // Restart if the app is still running
    if (!app.isQuitting) setTimeout(startPSSession, 1000)
  })

  // Load the module once, then promote all functions to global scope
  // so that Set-Alias -Scope Global aliases can resolve their targets
  const initScript = fs.existsSync(PSM1_PATH)
    ? `Import-Module '${PSM1_PATH.replace(/\\/g, '\\\\')}' -Force -DisableNameChecking -ErrorAction SilentlyContinue\n` +
      `Get-Command -Module SHLLSHOCKD -ErrorAction SilentlyContinue | Where-Object { $_.CommandType -eq 'Function' } | ForEach-Object { Set-Item "Function:Global:$($_.Name)" -Value $_.ScriptBlock -ErrorAction SilentlyContinue }\n`
    : `\n`

  psSession.stdin.write(initScript)
  psSession.stdin.write(`Write-Host '${SENTINEL}'\n`)

  // Wait for sentinel to confirm module is loaded
  const waitReady = setInterval(() => {
    if (psBuffer.includes(SENTINEL)) {
      psBuffer  = ''
      psReady   = true
      clearInterval(waitReady)
      console.log('[PS] Session ready')
      mainWindow && mainWindow.webContents.send('ps-ready')
    }
  }, 100)
}

function runInSession(command) {
  return new Promise((resolve, reject) => {
    if (!psSession || !psReady) {
      return reject(new Error('PowerShell session not ready'))
    }

    psBuffer = ''
    const timeout = setTimeout(() => {
      resolve({ stdout: psBuffer.replace(SENTINEL, '').trim(), stderr: '', success: true })
    }, 30000)

    const poll = setInterval(() => {
      if (psBuffer.includes(SENTINEL)) {
        clearInterval(poll)
        clearTimeout(timeout)
        const output = psBuffer.replace(SENTINEL, '').trim()
        psBuffer = ''
        resolve({ stdout: output, stderr: '', success: true })
      }
    }, 50)

    // Write command + sentinel so we know when output is complete
    psSession.stdin.write(`${command}\n`)
    psSession.stdin.write(`Write-Host '${SENTINEL}'\n`)

    psSession.stderr.once('data', (data) => {
      clearInterval(poll)
      clearTimeout(timeout)
      psBuffer = ''
      resolve({ stdout: '', stderr: data.toString().trim(), success: false })
    })
  })
}

// ─── Window ───────────────────────────────────────────────────────────────────

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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  startPSSession()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => { app.isQuitting = true })
app.on('window-all-closed', () => {
  if (psSession) psSession.kill()
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC ──────────────────────────────────────────────────────────────────────

ipcMain.on('window-minimize', () => mainWindow && mainWindow.minimize())
ipcMain.on('window-maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('window-close', () => mainWindow && mainWindow.close())

ipcMain.handle('get-registry', async () => {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) return { error: `registry.json not found`, commands: [] }
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
    const commands = Array.isArray(parsed) ? parsed : (parsed.commands || [])
    console.log(`[registry] Loaded ${commands.length} commands from ${REGISTRY_PATH}`)
    return { commands }
  } catch (err) {
    console.error(`[registry] Error: ${err.message}`)
    return { error: err.message, commands: [] }
  }
})

ipcMain.handle('check-admin', async () => {
  try {
    const result = await runInSession(
      `[bool]([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`
    )
    return result.stdout.toLowerCase().includes('true')
  } catch {
    return false
  }
})

ipcMain.handle('ps-ready', () => psReady)

// Elevated one-shot process for [ADMIN] commands.
// Spawns a new pwsh with -Verb RunAs (UAC prompt), runs the command,
// streams output back. No persistent session — UAC is per-command.
function runElevated(psFunction) {
  return new Promise((resolve) => {
    const hasPsm1 = fs.existsSync(PSM1_PATH)
    const importLine = hasPsm1
      ? `Import-Module '${PSM1_PATH.replace(/\\/g, '\\\\')}' -Force -DisableNameChecking -ErrorAction SilentlyContinue; `
      : ''

    // Write a temp script file so we can capture output back to a temp file
    // (Start-Process -Verb RunAs can't pipe stdout back directly)
    const os = require('os')
    const tmpOut  = path.join(os.tmpdir(), `shllshockd_out_${Date.now()}.txt`)
    const tmpErr  = path.join(os.tmpdir(), `shllshockd_err_${Date.now()}.txt`)
    const script  = `${importLine}${psFunction}`
    const wrapped = `
      try {
        ${script}
      } catch {
        Write-Output $_.Exception.Message
      }
    `

    // Run elevated via Start-Process -Verb RunAs from the current (non-elevated) session
    const launcher = spawn('pwsh', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Start-Process pwsh -Verb RunAs -Wait -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command','${
        wrapped
          .replace(/'/g, "''")    // escape single quotes for PS string
          .replace(/\n/g, ' ')    // flatten to one line
      } | Tee-Object -FilePath ''${tmpOut}'' 2>''${tmpErr}''')`
    ], { windowsHide: true })

    launcher.on('close', () => {
      const stdout = fs.existsSync(tmpOut) ? fs.readFileSync(tmpOut, 'utf-8').trim() : ''
      const stderr = fs.existsSync(tmpErr) ? fs.readFileSync(tmpErr, 'utf-8').trim() : ''
      try { fs.unlinkSync(tmpOut) } catch {}
      try { fs.unlinkSync(tmpErr) } catch {}
      resolve({ stdout, stderr, success: true, elevated: true })
    })

    launcher.on('error', (err) => {
      resolve({ stdout: '', stderr: err.message, success: false, elevated: true })
    })
  })
}

// The click handler:
// - Non-admin → persistent session, instant response (~50ms)
// - Admin     → elevated one-shot process, UAC prompt, then result
ipcMain.handle('run-command', async (event, { psFunction, requiresAdmin }) => {
  if (!psFunction) return { stdout: '', stderr: 'No function specified.', success: false }

  if (requiresAdmin) {
    return await runElevated(psFunction)
  }

  if (!psReady) return { stdout: '', stderr: 'Session loading — try again in a moment.', success: false }
  try {
    return await runInSession(psFunction)
  } catch (err) {
    return { stdout: '', stderr: err.message, success: false }
  }
})
