import React from 'react'

const MODES = [
  {
    id: 'standard',
    label: 'Standard',
    description: 'Clean view — run commands, see results',
  },
  {
    id: 'guided',
    label: 'Guided',
    description: 'Shows aliases and hints for each command',
  },
  {
    id: 'expert',
    label: 'Expert',
    description: 'Shows underlying PowerShell function names',
  },
  {
    id: 'developer',
    label: 'Developer',
    description: 'Full command metadata + raw JSON fields',
  },
]

export default function ModeBar({ mode, onChange }) {
  return (
    <div className="modebar">
      {MODES.map((m) => (
        <button
          key={m.id}
          className={`mode-tab${mode === m.id ? ' mode-active' : ''}`}
          onClick={() => onChange(m.id)}
          title={m.description}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
