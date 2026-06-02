import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import SearchBar from './components/SearchBar.jsx'
import CommandCard from './components/CommandCard.jsx'
import ConfirmModal from './components/ConfirmModal.jsx'
import OutputPanel from './components/OutputPanel.jsx'
import ModeBar from './components/ModeBar.jsx'
import SubmissionModal from './components/SubmissionModal.jsx'
import CommunityTab from './components/CommunityTab.jsx'
import PricingModal from './components/PricingModal.jsx'
import LicenseSettings from './components/LicenseSettings.jsx'
import ProGate from './components/ProGate.jsx'

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
  const [showSubmissionModal, setShowSubmissionModal] = useState(false)
  const [activeTab, setActiveTab] = useState('commands')
  const [licenseStatus, setLicenseStatus] = useState({ status: 'unlicensed', pro: false })
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showLicenseSettings, setShowLicenseSettings] = useState(false)

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

        // Check license status
        const license = await window.shllshockd.getLicenseStatus()
        setLicenseStatus(license)
      } else {
        // Browser dev mode: load registry.json from public folder
        try {
          const response = await fetch('/registry.json')
          if (response.ok) {
            const data = await response.json()
            setCommands(data.commands || [])
          } else {
            setCommands(SAMPLE_COMMANDS)
          }
        } catch {
          setCommands(SAMPLE_COMMANDS)
        }
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl/Cmd+F: focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        document.querySelector('.search-input')?.focus()
      }
      // Escape: close confirmation modal
      if (e.key === 'Escape' && showConfirm) {
        handleCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showConfirm, handleCancel])

  const handleActionSuggestion = useCallback((psFunction) => {
    const actionCmd = commands.find((c) => c.psFunction === psFunction)
    if (actionCmd) {
      handleRunRequest(actionCmd)
    }
  }, [commands, handleRunRequest])

  const handlePurchase = (details) => {
    // In real implementation, redirect to Stripe or LemonSqueezy checkout
    // For now, show a success message with a test license key
    if (window.shllshockd?.generateLicenseKey) {
      window.shllshockd.generateLicenseKey(details.email).then((result) => {
        if (result.key) {
          alert(`Test license key generated:\n\n${result.key}\n\nUse this in License Settings to activate.`)
          setShowPricingModal(false)
          setShowLicenseSettings(true)
        }
      })
    }
  }

  const handleActivateLicense = async (licenseKey, email) => {
    return await window.shllshockd?.activateLicense(licenseKey, email)
  }

  const handleDeactivateLicense = async () => {
    return await window.shllshockd?.deactivateLicense()
  }

  return (
    <div className="app-shell">
      {/* Custom Titlebar */}
      <div className="titlebar" style={{ WebkitAppRegion: 'drag' }}>
        <span className="titlebar-name">SHLLSHOCKD</span>
        <span className="titlebar-sub">Windows commands for people who have work to do</span>
        <div className="titlebar-controls" style={{ WebkitAppRegion: 'no-drag' }}>
          {isAdmin && <span className="admin-indicator">ADMIN</span>}
          {licenseStatus.pro && <span className="pro-indicator">PRO</span>}
          {!licenseStatus.pro && (
            <button className="tb-btn upgrade-btn" onClick={() => setShowPricingModal(true)} title="Upgrade to Pro">
              ⭐ Pro
            </button>
          )}
          {licenseStatus.pro && (
            <button className="tb-btn license-btn" onClick={() => setShowLicenseSettings(true)} title="License settings">
              🔓
            </button>
          )}
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
          {/* Top bar: search + mode switcher + community button */}
          <div className="top-bar">
            {activeTab === 'commands' && (
              <>
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  resultCount={filteredCommands.length}
                />
                <ModeBar mode={mode} onChange={setMode} />
              </>
            )}
            <div className="tab-controls" style={{ marginLeft: 'auto', display: 'flex', gap: '8px', paddingRight: '16px' }}>
              <button
                className={`tab-btn ${activeTab === 'commands' ? 'active' : ''}`}
                onClick={() => setActiveTab('commands')}
              >
                🔍 Commands
              </button>
              <button
                className={`tab-btn ${activeTab === 'community' ? 'active' : ''}`}
                onClick={() => setActiveTab('community')}
              >
                👥 Community
              </button>
              <button
                className="tab-btn submit-btn"
                onClick={() => setShowSubmissionModal(true)}
                title="Submit a command you wish existed"
              >
                ➕ Submit
              </button>
            </div>
          </div>

          {/* Commands Tab */}
          {activeTab === 'commands' && (
            <>
              {/* Registry error */}
              {registryError && (
                <div className="registry-error">
                  <span className="error-icon">!</span>
                  <span>
                    registry.json not loaded: {registryError}. Place registry.json at C:\dev\shllshocked-ps\registry.json
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
            </>
          )}

          {/* Community Tab */}
          {activeTab === 'community' && (
            <ProGate
              isPro={licenseStatus.pro}
              onUpgradeClick={() => setShowPricingModal(true)}
              featureName="Community voting and submissions"
            >
              <CommunityTab isActive={activeTab === 'community'} />
            </ProGate>
          )}
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

      {/* Submission Modal */}
      <SubmissionModal
        isOpen={showSubmissionModal}
        onClose={() => setShowSubmissionModal(false)}
        categories={Object.values(CATEGORY_MAP).filter((v, i, a) => a.indexOf(v) === i && v !== 'All').sort()}
        existingCommands={commands}
      />

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        onPurchase={handlePurchase}
      />

      {/* License Settings */}
      <LicenseSettings
        isOpen={showLicenseSettings}
        onClose={() => setShowLicenseSettings(false)}
        licenseStatus={licenseStatus}
        onActivate={handleActivateLicense}
        onDeactivate={handleDeactivateLicense}
      />
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
