import React from 'react'
import '../styles/ProGate.css'

/**
 * Wrapper component that gates Pro features
 * If user doesn't have Pro license, shows upgrade prompt overlay
 */
export default function ProGate({ children, isPro, onUpgradeClick, featureName }) {
  if (isPro) {
    return <>{children}</>
  }

  return (
    <div className="pro-gate-wrapper">
      {children}
      <div className="pro-gate-overlay" onClick={onUpgradeClick}>
        <div className="pro-gate-content" onClick={(e) => e.stopPropagation()}>
          <div className="pro-gate-icon">🔒</div>
          <h3>Pro Feature</h3>
          <p>{featureName || 'This feature'} is available in Pro tier.</p>
          <button className="pro-gate-btn" onClick={onUpgradeClick}>
            Upgrade to Pro — $49
          </button>
        </div>
      </div>
    </div>
  )
}
