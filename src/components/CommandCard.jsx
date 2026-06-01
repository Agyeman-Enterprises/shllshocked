import React from 'react'

const RISK_CONFIG = {
  LOW: { label: 'LOW', className: 'risk-low' },
  MEDIUM: { label: 'MEDIUM', className: 'risk-medium' },
  HIGH: { label: 'HIGH', className: 'risk-high' },
  DESTRUCTIVE: { label: 'DESTRUCTIVE', className: 'risk-destructive' },
}

const CLASS_CONFIG = {
  action: { label: 'action', className: 'class-action' },
  symptom: { label: 'symptom', className: 'class-symptom' },
  decision: { label: 'decision', className: 'class-decision' },
  recovery: { label: 'recovery', className: 'class-recovery' },
}

export default function CommandCard({ command, mode, isAdmin, isRunning, psReady, onRun }) {
  const risk = RISK_CONFIG[(command.riskLevel || '').toUpperCase()] || RISK_CONFIG.LOW
  const cls  = CLASS_CONFIG[command.commandClass] || CLASS_CONFIG.action

  const notReady = !psReady
  const isDestructive = (command.riskLevel || '').toUpperCase() === 'DESTRUCTIVE'

  function copyToClipboard(text) {
    navigator.clipboard?.writeText(text).catch(() => {})
  }

  return (
    <div
      className={`command-card${isRunning ? ' card-running' : ''}`}
      role="article"
      aria-label={`${command.publicCommand}${command.requiresAdmin ? ' (requires admin)' : ''}`}
      tabIndex="0"
    >
      <div className="card-header">
        <div className="card-badges" role="group" aria-label="Command metadata">
          <span className={`risk-badge ${risk.className}`} role="img" aria-label={`Risk level: ${risk.label}`}>{risk.label}</span>
          <span className={`class-badge ${cls.className}`} role="img" aria-label={`Type: ${cls.label}`}>{cls.label}</span>
          {command.requiresAdmin && (
            <span className="admin-badge" role="img" aria-label="Requires admin privileges">ADMIN</span>
          )}
        </div>
        <span className="card-category" aria-label={`Category: ${command.category}`}>{command.category || ''}</span>
      </div>

      <div className="card-body">
        <div className="card-command" role="heading" aria-level="3">{command.publicCommand}</div>
        <div className="card-purpose" role="doc-subtitle">{command.plainEnglishPurpose}</div>

        {/* Expert mode: show raw PS command with copy button */}
        {(mode === 'expert' || mode === 'developer') && command.psFunction && (
          <div className="card-psfunction-row">
            <code className="card-psfunction">{command.psFunction}</code>
            <button
              className="copy-btn"
              onClick={() => copyToClipboard(command.psFunction)}
              title="Copy PowerShell command"
            >
              copy
            </button>
          </div>
        )}

        {/* Guided/developer mode: show aliases as "also try" phrases */}
        {command.aliases && command.aliases.length > 0 && mode === 'developer' && (
          <div className="card-aliases">
            {command.aliases.slice(0, 4).map((a, i) => (
              <span key={i} className="alias-pill">{a}</span>
            ))}
          </div>
        )}
      </div>

      <div className="card-footer">
        <button
          className={`run-btn${isDestructive ? ' run-btn-destructive' : ''}${notReady ? ' run-btn-loading' : ''}`}
          onClick={() => !notReady && !isRunning && onRun(command)}
          disabled={isRunning || notReady}
          title={
            notReady ? 'Loading Windows session...' :
            command.requiresAdmin ? 'Runs elevated — Windows will ask for permission' :
            undefined
          }
        >
          {isRunning ? 'Running...' : notReady ? 'Loading...' : command.requiresAdmin ? 'Run as Admin' : 'Run'}
        </button>
      </div>
    </div>
  )
}
