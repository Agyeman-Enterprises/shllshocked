import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import SearchBar from './components/SearchBar.jsx'
import CommandCard from './components/CommandCard.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'
import OutputPanel from './components/OutputPanel.jsx'
import ModeBar from './components/ModeBar.jsx'

// Maps sidebar display label → exact registry category name
const CATEGORY_MAP = {
  'All':          'All',
  'Privacy':      'Privacy & Tracking',
  'Speed':        'Speed & Performance',
  'Storage':      'Storage Recovery',
  'Network':      'Network & WiFi',
  'Power':        'Power & Battery',
  'Security':     'Security',
  'Apps':         'Apps & Bloatware',
  'Display':      'Display & Appearance',
  'Audio':        'Audio',
  'Files':        'File System Secrets',
  'Recovery':     'Recovery & Repair',
  'Printers':     'Printers',
  'Productivity': 'Productivity Gems',
  'Gaming':       'Gaming & Performance',
  'Time':         'Time & Locale',
  'Boot':         'Startup & Boot',
  'Nuclear':      'Nuclear Options',
  'Disk Ops':     'File & Disk Operations',
  'Symptoms':     'Symptoms',
}
const CATEGORIES = Object.keys(CATEGORY_MAP)

export default function App() {
  const [commands, setCommands] = useState([])
  const [registryError, setRegistryError] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCommand, setSelectedCommand] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [outputLog, setOutputLog] = useState(null)
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState('standard')
  const [psReady, setPsReady] = useState(false)

  // Load registry, watch for PS session ready
  useEffect(() => {
    async function init() {
      if (window.shllshockd) {
        const result = await window.shllshockd.getRegistry()
        if (result.error) setRegistryError(result.error)
        else setCommands(result.commands || [])

        // Check if session already ready (fast reload)
        const ready = await window.shllshockd.isReady()
        if (ready) setPsReady(true)

        // Listen for ready signal (normal first load)
        window.shllshockd.onReady(() => setPsReady(true))

        const admin = await window.shllshockd.checkAdmin()
        setIsAdmin(admin)
      } else {
        setCommands(SAMPLE_COMMANDS)
        setPsReady(true)
      }
    }
    init()
  }, [])

  // Filtered commands
  const filteredCommands = useMemo(() => {
    let list = commands

    if (selectedCategory !== 'All') {
      const fullName = CATEGORY_MAP[selectedCategory] || selectedCategory
      list = list.filter((c) => (c.category || '') === fullName)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((c) => {
        const inName = (c.publicCommand || '').toLowerCase().includes(q)
        const inPurpose = (c.plainEnglishPurpose || '').toLowerCase().includes(q)
        const inAliases = (c.aliases || []).some((a) => a.toLowerCase().includes(q))
        const inDesc = (c.description || '').toLowerCase().includes(q)
        return inName || inPurpose || inAliases || inDesc
      })
    }

    return list
  }, [commands, selectedCategory, searchQuery])

  // Category counts keyed by SIDEBAR label (not registry name)
  const categoryCounts = useMemo(() => {
    const counts = { All: commands.length }
    const reverseMap = Object.fromEntries(
      Object.entries(CATEGORY_MAP).map(([label, full]) => [full, label])
    )
    commands.forEach((c) => {
      const label = reverseMap[c.category] || c.category
      counts[label] = (counts[label] || 0) + 1
    })
    return counts
  }, [commands])

  const handleRunRequest = useCallback((cmd) => {
    setSelectedCommand(cmd)
    if (cmd.requiresConfirmation || cmd.riskLevel === 'DESTRUCTIVE') {
      setShowConfirm(true)
    } else {
      executeCommand(cmd)
    }
  }, [])

  const executeCommand = useCallback(async (cmd) => {
    if (!cmd || !cmd.psFunction) return
    setIsRunning(true)
    setOutputLog(null)

    const startTime = new Date()

    try {
      let result
      if (window.shllshockd) {
        result = await window.shllshockd.runCommand(cmd.psFunction, cmd.requiresAdmin)
      } else {
        // Dev browser fallback
        result = {
          stdout: `[DEV MODE] Would run: ${cmd.psFunction}`,
          stderr: '',
          exitCode: 0,
          success: true,
        }
      }

      setOutputLog({
        command: cmd.publicCommand,
        psFunction: cmd.psFunction,
        stdout: result.stdout,
        stderr: result.stderr,
        success: result.success,
        exitCode: result.exitCode,
        timestamp: startTime,
        afterRunMessage: result.success ? cmd.afterRunMessage : null,
      })
    } catch (err) {
      setOutputLog({
        command: cmd.publicCommand,
        psFunction: cmd.psFunction,
        stdout: '',
        stderr: err.message,
        success: false,
        exitCode: -1,
        timestamp: startTime,
        afterRunMessage: null,
      })
    } finally {
      setIsRunning(false)
    }
  }, [])

  const handleConfirm = useCallback(() => {
    setShowConfirm(false)
    if (selectedCommand) executeCommand(selectedCommand)
  }, [selectedCommand, executeCommand])

  const handleCancel = useCallback(() => {
    setShowConfirm(false)
    setSelectedCommand(null)
  }, [])

  const handleActionSuggestion = useCallback((psFunction) => {
    const actionCmd = commands.find((c) => c.psFunction === psFunction)
    if (actionCmd) {
      handleRunRequest(actionCmd)
    }
  }, [commands, handleRunRequest])

  return (
    <div className="app-shell">
      {/* Custom Titlebar */}
      <div className="titlebar" style={{ WebkitAppRegion: 'drag' }}>
        <span className="titlebar-name">SHLLSHOCKD</span>
        <span className="titlebar-sub">Windows commands for people who have work to do</span>
        <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' }}>
          {isAdmin && <span className="admin-indicator">ADMIN</span>}
          <button className="tb-btn" onClick={() => window.shllshockd?.minimize()}>&#8722;</button>
          <button className="tb-btn" onClick={() => window.shllshockd?.maximize()}>&#9633;</button>
          <button className="tb-btn tb-close" onClick={() => window.shllshockd?.close()}>&#10005;</button>
        </div>
      </div>

      <div className="app-body">
        {/* Left Sidebar */}
        <Sidebar
          categories={CATEGORIES}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat)
            setSearchQuery('')
          }}
          categoryCounts={categoryCounts}
        />

        {/* Main Content */}
        <div className="main-content">
          {/* Top bar: search + mode switcher */}
          <div className="top-bar">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              resultCount={filteredCommands.length}
            />
            <ModeBar mode={mode} onChange={setMode} />
          </div>

          {/* Registry error */}
          {registryError && (
            <div className="registry-error">
              <span className="error-icon">!</span>
              <span>
                registry.json not loaded: {registryError}. Place registry.json at C:\dev\SHLLSHOCKD\registry.json
              </span>
            </div>
          )}

          {/* Commands grid */}
          <div className="commands-grid">
            {filteredCommands.length === 0 && !registryError && (
              <div className="empty-state">
                {commands.length === 0
                  ? 'No commands loaded. Check registry.json path.'
                  : 'No commands match your search.'}
              </div>
            )}
            {!psReady && commands.length > 0 && (
              <div className="ps-loading">
                <span className="ps-dot" />
                Loading Windows session... commands will be ready in a moment.
              </div>
            )}
            {filteredCommands.map((cmd, i) => (
              <CommandCard
                key={cmd.id || cmd.psFunction || i}
                command={cmd}
                mode={mode}
                isAdmin={isAdmin}
                psReady={psReady}
                isRunning={isRunning && selectedCommand?.psFunction === cmd.psFunction}
                onRun={handleRunRequest}
              />
            ))}
          </div>

          {/* Output Panel */}
          <OutputPanel
            log={outputLog}
            isRunning={isRunning}
            onClear={() => setOutputLog(null)}
            onAction={handleActionSuggestion}
          />
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && selectedCommand && (
        <ConfirmModal
          command={selectedCommand}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

// Sample commands for browser-only dev (no Electron)
const SAMPLE_COMMANDS = [
  {
    id: 'sample-1',
    publicCommand: 'Clear DNS Cache',
    plainEnglishPurpose: 'Websites not loading? Flush the DNS cache to force fresh lookups.',
    psFunction: 'Clear-DnsClientCache',
    category: 'Network',
    riskLevel: 'LOW',
    requiresAdmin: true,
    requiresConfirmation: false,
    commandClass: 'action',
    aliases: ['flush dns', 'dns reset', 'fix website not loading'],
    afterRunMessage: 'DNS cache cleared. Try the website again.',
  },
  {
    id: 'sample-2',
    publicCommand: 'Disable Telemetry',
    plainEnglishPurpose: 'Stop Windows from sending usage data to Microsoft.',
    psFunction: 'Disable-AETelemetry',
    category: 'Privacy',
    riskLevel: 'MEDIUM',
    requiresAdmin: true,
    requiresConfirmation: true,
    commandClass: 'action',
    aliases: ['privacy', 'tracking', 'stop spying'],
    beforeRunMessage: 'This will disable Windows diagnostic data collection.',
    afterRunMessage: 'Telemetry disabled. A restart may be required for all changes to take effect.',
  },
  {
    id: 'sample-3',
    publicCommand: 'Nuke Temp Files',
    plainEnglishPurpose: 'Delete all temporary files to reclaim disk space fast.',
    psFunction: 'Remove-AETempFiles',
    category: 'Storage',
    riskLevel: 'DESTRUCTIVE',
    requiresAdmin: false,
    requiresConfirmation: true,
    commandClass: 'action',
    aliases: ['clean junk', 'free space', 'delete temp'],
    beforeRunMessage: 'This will permanently delete all files in %TEMP% and Windows temp folders.',
    warningMessage: 'Cannot be undone. Files currently in use will be skipped.',
    afterRunMessage: 'Temp files removed. Check how much space was freed.',
  },
]
