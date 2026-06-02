import React, { useState } from 'react'
import '../styles/SubmissionModal.css'

export default function SubmissionModal({ isOpen, onClose, categories, existingCommands }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    psFunction: '',
    aliases: '',
    category: 'Productivity Gems',
    riskLevel: 'low',
    beforeRunMessage: '',
    afterRunMessage: '',
    requiresAdmin: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const validateForm = () => {
    if (!formData.title.trim()) return 'Problem title is required'
    if (!formData.description.trim()) return 'Description is required'
    if (!formData.psFunction.trim()) return 'Command name is required'
    if (!formData.beforeRunMessage.trim()) return 'Before run message is required'
    if (!formData.afterRunMessage.trim()) return 'After run message is required'

    // Check for duplicates in psFunction and aliases
    const allExisting = existingCommands || []
    const newFunc = formData.psFunction.toLowerCase().trim()
    const newAliases = formData.aliases.split(',').map(a => a.toLowerCase().trim()).filter(Boolean)

    for (const cmd of allExisting) {
      if (cmd.psFunction?.toLowerCase() === newFunc) {
        return `Command "${newFunc}" already exists in registry`
      }
      const existingAliases = (cmd.aliases || []).map(a => a.toLowerCase())
      for (const alias of newAliases) {
        if (existingAliases.includes(alias)) {
          return `Alias "${alias}" already exists in registry`
        }
      }
    }

    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)

    try {
      const submission = {
        id: `submission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        submitter: 'anonymous',
        timestamp: Date.now(),
        title: formData.title,
        description: formData.description,
        psFunction: formData.psFunction.trim(),
        aliases: formData.aliases.split(',').map(a => a.trim()).filter(Boolean),
        category: formData.category,
        riskLevel: formData.riskLevel,
        requiresAdmin: formData.requiresAdmin,
        beforeRunMessage: formData.beforeRunMessage,
        afterRunMessage: formData.afterRunMessage,
        votes: 0,
        flagged: false,
        status: 'pending',
        approvedAt: null,
      }

      // Send via IPC
      if (window.shllshockd?.saveSubmission) {
        await window.shllshockd.saveSubmission(submission)
      }

      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        setFormData({
          title: '',
          description: '',
          psFunction: '',
          aliases: '',
          category: 'Productivity Gems',
          riskLevel: 'low',
          beforeRunMessage: '',
          afterRunMessage: '',
          requiresAdmin: false,
        })
        onClose()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to submit command')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="submission-modal-overlay" onClick={onClose}>
      <div className="submission-modal" onClick={(e) => e.stopPropagation()}>
        <div className="submission-header">
          <h2>Submit a Command</h2>
          <button className="submission-close" onClick={onClose}>×</button>
        </div>

        {submitted ? (
          <div className="submission-success">
            <div className="success-icon">✓</div>
            <h3>Command submitted!</h3>
            <p>Thanks for contributing to SHLLSHOCKD. Your submission is now in the community queue for voting.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="submission-form">
            {error && <div className="submission-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="title">What problem does this solve?</label>
              <input
                id="title"
                type="text"
                name="title"
                placeholder="e.g., 'Stop Cortana from listening'"
                value={formData.title}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Describe the problem and how your command helps</label>
              <textarea
                id="description"
                name="description"
                placeholder="e.g., 'Cortana is always listening in the background. This command disables the voice activation service...'"
                value={formData.description}
                onChange={handleChange}
                disabled={isSubmitting}
                rows="3"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="psFunction">Command name (no spaces)</label>
                <input
                  id="psFunction"
                  type="text"
                  name="psFunction"
                  placeholder="e.g., kill-cortana-listening"
                  value={formData.psFunction}
                  onChange={handleChange}
                  disabled={isSubmitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="aliases">Alternate names (comma-separated, optional)</label>
              <input
                id="aliases"
                type="text"
                name="aliases"
                placeholder="e.g., 'silence cortana, turn off cortana, disable cortana'"
                value={formData.aliases}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="riskLevel">Risk level</label>
                <select
                  id="riskLevel"
                  name="riskLevel"
                  value={formData.riskLevel}
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="destructive">Destructive</option>
                </select>
              </div>

              <div className="form-group checkbox">
                <label htmlFor="requiresAdmin">
                  <input
                    id="requiresAdmin"
                    type="checkbox"
                    name="requiresAdmin"
                    checked={formData.requiresAdmin}
                    onChange={handleChange}
                    disabled={isSubmitting}
                  />
                  Requires admin privileges
                </label>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="beforeRunMessage">Before you confirm...</label>
              <textarea
                id="beforeRunMessage"
                name="beforeRunMessage"
                placeholder="What should users know before running? e.g., 'This will disable Cortana voice activation...'"
                value={formData.beforeRunMessage}
                onChange={handleChange}
                disabled={isSubmitting}
                rows="2"
              />
            </div>

            <div className="form-group">
              <label htmlFor="afterRunMessage">After it runs...</label>
              <textarea
                id="afterRunMessage"
                name="afterRunMessage"
                placeholder="What's the expected result? e.g., 'Cortana will no longer listen for wake words...'"
                value={formData.afterRunMessage}
                onChange={handleChange}
                disabled={isSubmitting}
                rows="2"
              />
            </div>

            <div className="submission-actions">
              <button
                type="button"
                className="submission-btn-cancel"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="submission-btn-submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Command'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
