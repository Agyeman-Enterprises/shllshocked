import React, { useState } from 'react'
import '../styles/LicenseSettings.css'

export default function LicenseSettings({ isOpen, onClose, licenseStatus, onActivate, onDeactivate }) {
  const [licenseKey, setLicenseKey] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleActivate = async () => {
    setError(null)
    setSuccess(null)

    if (!licenseKey.trim()) {
      setError('Please enter your license key')
      return
    }

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    try {
      const result = await onActivate(licenseKey, email)
      if (result.success) {
        setSuccess(`License activated for ${email}! 🎉`)
        setLicenseKey('')
        setEmail('')
        setTimeout(() => {
          onClose()
        }, 2000)
      } else {
        setError(result.error || 'Failed to activate license')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeactivate = async () => {
    if (window.confirm('Deactivate your Pro license? You can reactivate it later.')) {
      setIsLoading(true)
      try {
        const result = await onDeactivate()
        if (result.success) {
          setSuccess('License deactivated')
          setTimeout(() => {
            onClose()
          }, 1500)
        } else {
          setError(result.error || 'Failed to deactivate license')
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setIsLoading(false)
      }
    }
  }

  if (!isOpen) return null

  const isPro = licenseStatus?.status === 'valid' && licenseStatus?.pro

  return (
    <div className="license-settings-overlay" onClick={onClose}>
      <div className="license-settings" onClick={(e) => e.stopPropagation()}>
        <div className="license-header">
          <h2>License Settings</h2>
          <button className="license-close" onClick={onClose}>×</button>
        </div>

        <div className="license-content">
          {isPro ? (
            <>
              <div className="license-status-active">
                <div className="status-badge">✓ Pro Active</div>
                <h3>{licenseStatus.email}</h3>
                <p>Purchased {new Date(licenseStatus.purchasedAt).toLocaleDateString()}</p>
                <button
                  className="btn-deactivate"
                  onClick={handleDeactivate}
                  disabled={isLoading}
                >
                  Deactivate License
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="license-status-inactive">
                <p>No active Pro license</p>
              </div>

              <div className="license-form">
                <h3>Activate License Key</h3>
                <p className="form-hint">Enter your license key and email to activate Pro</p>

                <div className="form-group">
                  <label htmlFor="license-email">Email</label>
                  <input
                    id="license-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="license-key">License Key</label>
                  <input
                    id="license-key"
                    type="password"
                    placeholder="SHLLSHOCKD-..."
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                    disabled={isLoading}
                  />
                </div>

                {error && <div className="license-error">{error}</div>}
                {success && <div className="license-success">{success}</div>}

                <button
                  className="btn-activate"
                  onClick={handleActivate}
                  disabled={isLoading || !licenseKey || !email}
                >
                  {isLoading ? 'Validating...' : 'Activate'}
                </button>
              </div>

              <div className="license-footer">
                <p>Don't have a license? <a href="#" onClick={() => window.shllshockd?.showPricingModal?.()}>Buy Pro</a></p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
