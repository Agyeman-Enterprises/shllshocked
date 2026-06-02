const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')

const REGISTRY_PATH = 'C:\\dev\\shllshocked-ps\\registry.json'
const PSM1_PATH    = 'C:\\dev\\shllshocked-ps\\SHLLSHOCKD.psm1'
const SUBMISSIONS_PATH = path.join(app.getPath('userData'), 'submissions.json')
const isDev        = process.env.NODE_ENV === 'development' || !app.isPackaged

// Initialize submissions file if it doesn't exist
function initSubmissionsFile() {
  try {
    if (!fs.existsSync(SUBMISSIONS_PATH)) {
      const dir = path.dirname(SUBMISSIONS_PATH)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(SUBMISSIONS_PATH, JSON.stringify([], null, 2))
      console.log(`[submissions] Created ${SUBMISSIONS_PATH}`)
    }
  } catch (err) {
    console.error(`[submissions] Init error: ${err.message}`)
  }
}

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
  initSubmissionsFile()
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

// ─── Submission Handlers ──────────────────────────────────────────────────────

function loadSubmissions() {
  try {
    if (!fs.existsSync(SUBMISSIONS_PATH)) return []
    const data = fs.readFileSync(SUBMISSIONS_PATH, 'utf-8')
    return JSON.parse(data) || []
  } catch (err) {
    console.error(`[submissions] Load error: ${err.message}`)
    return []
  }
}

function saveSubmissions(submissions) {
  try {
    fs.writeFileSync(SUBMISSIONS_PATH, JSON.stringify(submissions, null, 2))
    console.log(`[submissions] Saved ${submissions.length} submissions`)
    return true
  } catch (err) {
    console.error(`[submissions] Save error: ${err.message}`)
    return false
  }
}

ipcMain.handle('load-submissions', async () => {
  return loadSubmissions()
})

ipcMain.handle('save-submission', async (event, submission) => {
  const submissions = loadSubmissions()
  submissions.push(submission)
  
  // Keep only last 1000 submissions
  if (submissions.length > 1000) {
    submissions.splice(0, submissions.length - 1000)
  }
  
  saveSubmissions(submissions)
  return { success: true, submission }
})

ipcMain.handle('upvote-submission', async (event, submissionId) => {
  const submissions = loadSubmissions()
  const submission = submissions.find(s => s.id === submissionId)
  
  if (submission) {
    submission.votes = (submission.votes || 0) + 1
    
    // Auto-approve at 10 votes (only if not already approved and not flagged)
    if (submission.votes >= 10 && submission.status === 'pending' && !submission.flagged) {
      submission.status = 'approved'
      submission.approvedAt = new Date().toISOString()
      console.log(`[submissions] Auto-approved "${submission.title}" (${submission.votes} votes)`)
    }
    
    saveSubmissions(submissions)
    return { success: true, submission }
  }
  
  return { success: false, error: 'Submission not found' }
})

ipcMain.handle('flag-submission', async (event, submissionId) => {
  const submissions = loadSubmissions()
  const submission = submissions.find(s => s.id === submissionId)
  
  if (submission) {
    submission.flagged = true
    saveSubmissions(submissions)
    return { success: true, submission }
  }
  
  return { success: false, error: 'Submission not found' }
})

ipcMain.handle('approve-submission', async (event, submissionId) => {
  const submissions = loadSubmissions()
  const submission = submissions.find(s => s.id === submissionId)
  
  if (!submission) {
    return { success: false, error: 'Submission not found' }
  }
  
  // Check for duplicates in registry
  try {
    const registryData = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
    const registry = registryData.commands || []
    
    // Duplicate check: psFunction + aliases
    const newFunc = submission.psFunction.toLowerCase().trim()
    const newAliases = (submission.aliases || []).map(a => a.toLowerCase())
    
    for (const cmd of registry) {
      if (cmd.psFunction?.toLowerCase() === newFunc) {
        return { success: false, error: `Command "${newFunc}" already exists in registry` }
      }
      const existingAliases = (cmd.aliases || []).map(a => a.toLowerCase())
      for (const alias of newAliases) {
        if (existingAliases.includes(alias)) {
          return { success: false, error: `Alias "${alias}" already exists in registry` }
        }
      }
    }
    
    // Merge into registry
    const commandToAdd = {
      id: submission.id,
      publicCommand: submission.title,
      aliases: submission.aliases || [],
      category: submission.category,
      commandClass: 'action',
      riskLevel: submission.riskLevel,
      requiresAdmin: submission.requiresAdmin || false,
      requiresConfirmation: submission.riskLevel === 'destructive' || submission.riskLevel === 'high',
      modes: ['standard', 'guided', 'expert'],
      bookChapter: 'Community Submissions',
      plainEnglishPurpose: submission.description,
      beforeRunMessage: submission.beforeRunMessage,
      afterRunMessage: submission.afterRunMessage,
      psFunction: submission.psFunction,
      source: 'community',
      submissionId: submission.id,
    }
    
    registry.push(commandToAdd)
    registryData.commands = registry
    registryData.totalCommands = registry.length
    
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registryData, null, 2))
    console.log(`[submissions] Approved and merged "${submission.title}" into registry`)
    
    // Mark submission as approved
    submission.status = 'approved'
    submission.approvedAt = new Date().toISOString()
    saveSubmissions(submissions)
    
    return { success: true, submission }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ─── License Handlers ─────────────────────────────────────────────────────────

const licenseModule = require('./license.js')

app.whenReady().then(() => {
  licenseModule.setUserDataPath(app.getPath('userData'))
  licenseModule.initLicenseFile()
})

ipcMain.handle('get-license-status', async () => {
  return licenseModule.getLicenseStatus()
})

ipcMain.handle('validate-license', async (event, { licenseKey, email }) => {
  return licenseModule.validateLicenseKey(licenseKey, email)
})

ipcMain.handle('activate-license', async (event, { licenseKey, email }) => {
  return licenseModule.activateLicense(licenseKey, email)
})

ipcMain.handle('deactivate-license', async () => {
  return licenseModule.deactivateLicense()
})

ipcMain.handle('generate-license-key', async (event, email) => {
  // Only allow generation in dev mode or if admin-protected
  if (isDev) {
    return { key: licenseModule.generateLicenseKey(email) }
  }
  return { error: 'License generation not allowed in production' }
})
