import React from 'react'

function formatTime(date) {
  if (!date) return ''
  return date.toLocaleTimeString('en-US', { hour12: false })
}

// Map discovery commands to their suggested action commands
const ACTION_SUGGESTIONS = {
  'show-startup-apps': { action: 'kill-startup-slowdown', label: 'Disable slow startup apps' },
  'see-ram-hogs': { action: 'free-up-ram-now', label: 'Free up RAM now' },
  'show-background-apps': { action: 'stop-background-apps', label: 'Stop background apps' },
  'show-scheduled-tasks': { action: 'disable-scheduled-tasks', label: 'Disable unnecessary tasks' },
  'find-hidden-downloads': { action: 'delete-old-downloads', label: 'Delete old downloads' },
  'see-all-installed-apps': { action: 'uninstall-bloatware', label: 'Uninstall unnecessary apps' },
}

export default function OutputPanel({ log, isRunning, onClear, onAction }) {
  if (!log && !isRunning) return null

  const actionSuggestion = log && ACTION_SUGGESTIONS[log.psFunction]

  return (
    <div className="output-panel">
      <div className="output-header">
        <div className="output-meta">
          {isRunning ? (
            <span className="output-running">&#9654; Running...</span>
          ) : (
            <>
              <span className={`output-status-dot ${log?.success ? 'dot-ok' : 'dot-err'}`} />
              <span className="output-cmd-name">{log?.command}</span>
              <span className="output-time">{formatTime(log?.timestamp)}</span>
            </>
          )}
        </div>
        {log && !isRunning && (
          <div className="output-actions">
            {actionSuggestion && log.success && (
              <button
                className="output-action-btn"
                onClick={() => onAction?.(actionSuggestion.action)}
                title={actionSuggestion.label}
              >
                {actionSuggestion.label}
              </button>
            )}
            <button className="output-clear" onClick={onClear} title="Clear output">
              Clear
            </button>
          </div>
        )}
      </div>

      {log && !isRunning && (
        <div className="output-body">
          {log.stdout && (
            <pre className="output-stdout">{log.stdout}</pre>
          )}

          {log.stderr && (
            <pre className="output-stderr">{log.stderr}</pre>
          )}

          {!log.stdout && !log.stderr && log.success && (
            <pre className="output-stdout output-empty">Command completed with no output.</pre>
          )}

          {log.afterRunMessage && log.success && (
            <div className="output-after-msg">
              <span className="after-icon">&#10003;</span>
              <span>{log.afterRunMessage}</span>
            </div>
          )}

          {!log.success && (
            <div className="output-exit-code">
              Exit code: {log.exitCode}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
