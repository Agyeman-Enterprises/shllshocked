import React, { useState, useEffect } from 'react'
import '../styles/CommunityTab.css'

export default function CommunityTab({ isActive }) {
  const [submissions, setSubmissions] = useState([])
  const [userVotes, setUserVotes] = useState({})
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    if (isActive) {
      loadSubmissions()
    }
  }, [isActive])

  const loadSubmissions = async () => {
    setLoading(true)
    try {
      if (window.shllshockd?.loadSubmissions) {
        const data = await window.shllshockd.loadSubmissions()
        setSubmissions(data || [])
      }
    } catch (err) {
      console.error('Failed to load submissions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUpvote = async (submissionId) => {
    if (userVotes[submissionId]) {
      return // Already voted
    }

    try {
      if (window.shllshockd?.upvoteSubmission) {
        await window.shllshockd.upvoteSubmission(submissionId)
        setUserVotes(prev => ({
          ...prev,
          [submissionId]: true
        }))
        await loadSubmissions()
      }
    } catch (err) {
      console.error('Failed to upvote:', err)
    }
  }

  const handleApprove = async (submission) => {
    const confirmed = window.confirm(
      `Approve "${submission.title}" to the official registry?\n\nIt will be added to the ${submission.category} category.`
    )
    if (!confirmed) return

    try {
      if (window.shllshockd?.approveSubmission) {
        await window.shllshockd.approveSubmission(submission.id)
        await loadSubmissions()
      }
    } catch (err) {
      console.error('Failed to approve:', err)
    }
  }

  const handleFlag = async (submissionId) => {
    try {
      if (window.shllshockd?.flagSubmission) {
        await window.shllshockd.flagSubmission(submissionId)
        await loadSubmissions()
      }
    } catch (err) {
      console.error('Failed to flag submission:', err)
    }
  }

  const filteredSubmissions = submissions.filter(s => {
    if (filter === 'pending') return s.status === 'pending'
    if (filter === 'approved') return s.status === 'approved'
    if (filter === 'flagged') return s.flagged
    return true
  })

  const pendingCount = submissions.filter(s => s.status === 'pending').length
  const approvedCount = submissions.filter(s => s.status === 'approved').length

  if (!isActive) return null

  return (
    <div className="community-tab">
      <div className="community-header">
        <h2>Community Commands</h2>
        <p>Share your "pet peeves" — commands you wish existed. Vote on what others submit.</p>
      </div>

      <div className="community-stats">
        <div className="stat-card">
          <div className="stat-number">{pendingCount}</div>
          <div className="stat-label">Pending Review</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{approvedCount}</div>
          <div className="stat-label">Approved & Live</div>
        </div>
      </div>

      <div className="community-filters">
        <button
          className={`filter-btn ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={`filter-btn ${filter === 'approved' ? 'active' : ''}`}
          onClick={() => setFilter('approved')}
        >
          Approved ({approvedCount})
        </button>
        <button
          className={`filter-btn ${filter === 'flagged' ? 'active' : ''}`}
          onClick={() => setFilter('flagged')}
        >
          Flagged
        </button>
      </div>

      {loading && <div className="community-loading">Loading submissions...</div>}

      {!loading && filteredSubmissions.length === 0 && (
        <div className="community-empty">
          <div className="empty-icon">📭</div>
          <h3>
            {filter === 'pending' && 'No pending submissions yet'}
            {filter === 'approved' && 'No approved submissions yet'}
            {filter === 'flagged' && 'No flagged submissions'}
          </h3>
          <p>Be the first to submit a command!</p>
        </div>
      )}

      <div className="submissions-list">
        {filteredSubmissions.map(submission => (
          <div key={submission.id} className="submission-card">
            <div className="submission-card-header">
              <div className="submission-title-area">
                <h3>{submission.title}</h3>
                <div className="submission-badges">
                  <span className={`badge badge-risk badge-${submission.riskLevel}`}>
                    {submission.riskLevel}
                  </span>
                  {submission.requiresAdmin && <span className="badge badge-admin">ADMIN</span>}
                  <span className={`badge badge-status badge-${submission.status}`}>
                    {submission.status}
                  </span>
                  {submission.flagged && <span className="badge badge-flagged">⚠️ Flagged</span>}
                </div>
              </div>
              <div className="submission-votes">
                <button
                  className={`vote-btn ${userVotes[submission.id] ? 'voted' : ''}`}
                  onClick={() => handleUpvote(submission.id)}
                  disabled={userVotes[submission.id]}
                  title={userVotes[submission.id] ? 'You already voted' : 'Upvote this command'}
                >
                  👍 {submission.votes}
                </button>
              </div>
            </div>

            <div className="submission-meta">
              <span className="meta-item">📋 {submission.category}</span>
              <span className="meta-item">⌨️ {submission.psFunction}</span>
              <span className="meta-item">🕐 {new Date(submission.timestamp).toLocaleDateString()}</span>
            </div>

            <p className="submission-description">{submission.description}</p>

            <div className="submission-messages">
              <div className="message-box">
                <strong>Before:</strong> {submission.beforeRunMessage}
              </div>
              <div className="message-box">
                <strong>After:</strong> {submission.afterRunMessage}
              </div>
            </div>

            {submission.aliases && submission.aliases.length > 0 && (
              <div className="submission-aliases">
                <strong>Also known as:</strong> {submission.aliases.join(', ')}
              </div>
            )}

            <div className="submission-actions">
              {submission.status === 'pending' && submission.votes >= 10 && (
                <span className="auto-approve-hint">Ready for auto-approval (10+ votes)</span>
              )}
              {window.shllshockd?.isAdmin && (
                <>
                  {submission.status === 'pending' && (
                    <>
                      <button
                        className="action-btn action-approve"
                        onClick={() => handleApprove(submission)}
                      >
                        ✓ Approve
                      </button>
                      <button
                        className="action-btn action-flag"
                        onClick={() => handleFlag(submission.id)}
                      >
                        ⚠️ Flag
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
