import React, { useState } from 'react'
import '../styles/PricingModal.css'

export default function PricingModal({ isOpen, onClose, onPurchase }) {
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState(null)

  const handlePurchase = () => {
    setError(null)

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    if (!selectedPayment) {
      setError('Please select a payment method')
      return
    }

    onPurchase({ email, method: selectedPayment })
  }

  if (!isOpen) return null

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pricing-header">
          <h2>Upgrade to Pro</h2>
          <button className="pricing-close" onClick={onClose}>×</button>
        </div>

        <div className="pricing-content">
          <div className="pricing-highlight">
            <div className="price">$49</div>
            <div className="frequency">one-time payment</div>
            <p className="tagline">Unlock all Pro features forever</p>
          </div>

          <div className="pro-features">
            <h3>Pro includes:</h3>
            <ul>
              <li>✓ Vote on community commands</li>
              <li>✓ Script annotator (detailed explanations)</li>
              <li>✓ Batch export commands</li>
              <li>✓ Auto-save and cloud sync (coming soon)</li>
              <li>✓ Priority support</li>
            </ul>
          </div>

          <div className="payment-methods">
            <h3>Payment Method</h3>
            <div className="method-buttons">
              <button
                className={`method-btn ${selectedPayment === 'stripe' ? 'active' : ''}`}
                onClick={() => setSelectedPayment('stripe')}
              >
                💳 Stripe
              </button>
              <button
                className={`method-btn ${selectedPayment === 'lemonsqueezy' ? 'active' : ''}`}
                onClick={() => setSelectedPayment('lemonsqueezy')}
              >
                🍋 Lemon Squeezy
              </button>
            </div>
          </div>

          <div className="email-input-group">
            <label htmlFor="pricing-email">Email for receipt & license key</label>
            <input
              id="pricing-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handlePurchase()}
            />
          </div>

          {error && <div className="pricing-error">{error}</div>}

          <div className="pricing-actions">
            <button className="btn-cancel" onClick={onClose}>Cancel</button>
            <button
              className="btn-purchase"
              onClick={handlePurchase}
              disabled={!email || !selectedPayment}
            >
              Continue to Checkout
            </button>
          </div>

          <p className="pricing-footer">
            No subscriptions. 30-day money-back guarantee.
          </p>
        </div>
      </div>
    </div>
  )
}
