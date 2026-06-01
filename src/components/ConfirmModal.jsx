import React, { useState, useEffect } from 'react'

const RISK_LABELS = {
  LOW: { label: 'LOW RISK', className: 'risk-low' },
  MEDIUM: { label: 'MEDIUM RISK', className: 'risk-medium' },
  HIGH: { label: 'HIGH RISK', className: 'risk-high' },
  DESTRUCTIVE: { label: 'DESTRUCTIVE', className: 'risk-destructive' },
}

export default function ConfirmModal({ command, onConfirm, onCancel }) {
  const [typedConfirm, setTypedConfirm] = useState('')
  const isDestructive = command.riskLevel === 'DESTRUCTIVE'
  const risk = RISK_LABELS[command.riskLevel] || RISK_LABELS.MEDIUM

  const canProceed = !isDestructive || typedConfirm.trim().toUpperCase() === 'YES'

  // Keyboard shortcut: Enter = confirm (if allowed), Escape = cancel
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter' && canProceed) onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canProceed, onCancel, onConfirm])

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className={`risk-badge ${risk.className}`}>{risk.label}</span>
          <h2 className="modal-title">{command.publicCommand}</h2>
        </div>

        {command.plainEnglishPurpose && (
          <p className="modal-purpose">{command.plainEnglishPurpose}</p>
        )}

        {command.beforeRunMessage && (
          <div className="modal-before-msg">
            <span className="msg-icon">&#9432;</span>
            <span>{command.beforeRunMessage}</span>
          </div>
        )}

        {isDestructive && command.warningMessage && (
          <div className="modal-warning">
            <span className="warn-icon">&#9888;</span>
            <span>{command.warningMessage}</span>
          </div>
        )}

        {isDestructive && (
          <div className="modal-type-confirm">
            <label className="type-confirm-label">
              Type YES to confirm this destructive action
            </label>
            <input
              type="text"
              className="type-confirm-input"
              placeholder="YES"
              value={typedConfirm}
              onChange={(e) => setTypedConfirm(e.target.value)}
              autoFocus
              spellCheck={false}
            />
          </div>
        )}

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`btn-confirm${isDestructive ? ' btn-confirm-destructive' : ''}`}
            onClick={onConfirm}
            disabled={!canProceed}
          >
            {isDestructive ? 'Yes, run it' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
