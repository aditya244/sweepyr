'use client'

import { useState, useEffect, useRef } from 'react'

const CATEGORY_EMOJIS = {
  'Spam':           '🚫',
  'Promotions':     '🛍️',
  'Newsletter':     '📰',
  'Social':         '💬',
  'OTP & Security': '🔐',
  'Transactions':   '💳',
  'Receipts':       '🧾',
  'Finance':        '🏦',
  'Work':           '💼',
  'Personal':       '👤',
  'Notifications':  '🔔',
  'Travel':         '✈️',
  'Jobs & Careers': '💼',
  'Uncertain':      '❓',
}

const ALL_CATEGORIES = [
  'Spam', 'Promotions', 'Newsletter', 'Social',
  'OTP & Security', 'Transactions', 'Receipts',
  'Finance', 'Work', 'Personal', 'Notifications',
  'Travel', 'Jobs & Careers', 'Uncertain',
]

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function parseSenderName(from) {
  if (!from) return 'Unknown'
  const match = from.match(/^(.+?)\s*</)
  if (match) return match[1].replace(/"/g, '').trim()
  return from.split('@')[0]
}

export default function MonitoringFeed({ onStatsRefresh }) {
  const [emails, setEmails] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalMonitored, setTotalMonitored] = useState(0)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [actioning, setActioning] = useState(null)
  const [isScrollable, setIsScrollable] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    loadEmails(1)
  }, [])

  async function loadEmails(pageNum) {
    try {
      if (pageNum === 1) setLoading(true)
      else setLoadingMore(true)

      const res = await fetch(`/api/emails/monitored?page=${pageNum}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)

      if (pageNum === 1) {
        setEmails(data.emails)
      } else {
        setEmails(prev => [...prev, ...data.emails])
        // Enable scroll mode when loading more
        setIsScrollable(true)
      }

      setPage(pageNum)
      setHasMore(data.hasMore)
      setTotalMonitored(data.totalMonitored)
      setHiddenCount(data.hiddenCount)

    } catch (err) {
      console.error('MonitoringFeed error:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function handleAction(action, email) {
    try {
      setActioning(email.messageId)

      const res = await fetch('/api/emails/feed-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          messageId: email.messageId,
          category: email.category,
        }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Remove from feed immediately
      setEmails(prev => prev.filter(e => e.messageId !== email.messageId))
      setTotalMonitored(prev => prev - 1)

      // Refresh stats
      if (onStatsRefresh) onStatsRefresh()

    } catch (err) {
      console.error('Feed action error:', err)
    } finally {
      setActioning(null)
    }
  }

  async function handleMove(email, newCategory) {
    try {
      setActioning(email.messageId)

      const res = await fetch(`/api/emails/${email.messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory }),
      })

      const data = await res.json()
      if (data.error) throw new Error(data.error)

      // Update category in feed instead of removing
      setEmails(prev => prev.map(e =>
        e.messageId === email.messageId ? { ...e, category: newCategory } : e
      ))

    } catch (err) {
      console.error('Move error:', err)
    } finally {
      setActioning(null)
    }
  }

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      border: '1px solid #e5e7eb',
      marginBottom: '24px',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid #f3f4f6',
        backgroundColor: '#fafafa',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>📡</span>
          <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
            Live Monitoring
          </span>
          {totalMonitored > 0 && (
            <span style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#0d9488',
              backgroundColor: '#f0fdfa',
              padding: '2px 8px',
              borderRadius: '999px',
            }}>
              {totalMonitored} new
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#9ca3af' }}>
          Auto-classified
        </span>
      </div>

      {/* Body */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <div style={{
            width: '20px', height: '20px',
            border: '2px solid #e5e7eb',
            borderTopColor: '#0d9488',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0' }}>
            Checking for monitored emails...
          </p>
        </div>

      ) : emails.length === 0 ? (
        // Empty state
        <div style={{ padding: '32px', textAlign: 'center' }}>
          <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📡</span>
          <p style={{ fontSize: '14px', fontWeight: '500', color: '#374151', margin: '0 0 6px 0' }}>
            Watching your inbox
          </p>
          <p style={{ fontSize: '13px', color: '#9ca3af', margin: '0', lineHeight: '1.5' }}>
            New emails will appear here automatically as they arrive.
            <br />
            Full monitoring activates in an upcoming update.
          </p>
        </div>

      ) : (
        <>
          {/* Email list — scrollable when more than 10 loaded */}
          <div
            ref={scrollRef}
            style={{
              maxHeight: isScrollable ? '420px' : 'none',
              overflowY: isScrollable ? 'auto' : 'visible',
            }}
          >
            {emails.map(email => {
              const isActioning = actioning === email.messageId
              const senderName = parseSenderName(email.from)
              const categoryEmoji = CATEGORY_EMOJIS[email.category] || '📧'

              return (
                <div
                  key={email.messageId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid #f9fafb',
                    gap: '12px',
                    opacity: isActioning ? 0.5 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  {/* Left — email info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                        {senderName}
                      </span>
                      <span style={{ fontSize: '11px', color: '#9ca3af', flexShrink: 0 }}>
                        {timeAgo(email.monitoredAt || email.date)}
                      </span>
                    </div>
                    <p style={{ margin: '0', fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {email.subject || '(no subject)'}
                    </p>
                  </div>

                  {/* Middle — category badge */}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      fontSize: '11px',
                      color: '#0d9488',
                      backgroundColor: '#f0fdfa',
                      padding: '3px 8px',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {categoryEmoji} {email.category || 'Uncategorised'}
                    </span>
                  </div>

                  {/* Right — actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    {isActioning ? (
                      <span style={{ fontSize: '11px', color: '#9ca3af' }}>...</span>
                    ) : (
                      <>
                        {/* Reclassify dropdown */}
                        <select
                          defaultValue=""
                          onChange={e => {
                            if (e.target.value) handleMove(email, e.target.value)
                          }}
                          title="Changes how Sweepyr sorts this email. Nothing changes in Gmail."
                          style={{
                            fontSize: '11px',
                            border: '1px solid #e5e7eb',
                            borderRadius: '6px',
                            padding: '3px 6px',
                            color: '#6b7280',
                            backgroundColor: '#ffffff',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="" disabled>Reclassify</option>
                          {ALL_CATEGORIES.filter(c => c !== email.category).map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>

                        {/* Label */}
                        <button
                          onClick={() => handleAction('label', email)}
                          title={`Adds a Sweepyr/${email.category || 'Uncategorised'} label in Gmail. Emails stay in your inbox.`}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#f0fdfa',
                            border: '1px solid #5eead4',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#0f766e',
                          }}
                        >
                          🏷️
                        </button>

                        {/* Archive */}
                        <button
                          onClick={() => handleAction('archive', email)}
                          title="Removes from inbox, keeps in All Mail. Findable anytime via search."
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#fef3c7',
                            border: '1px solid #fcd34d',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#92400e',
                          }}
                        >
                          📦
                        </button>

                        {/* Trash */}
                        <button
                          onClick={() => handleAction('trash', email)}
                          title="Moves to Gmail Trash. Recoverable for 30 days."
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            backgroundColor: '#fee2e2',
                            border: '1px solid #fca5a5',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#991b1b',
                          }}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid #f3f4f6',
            backgroundColor: '#fafafa',
          }}>
            {hiddenCount > 0 ? (
              // Beyond 50 cap
              <p style={{ fontSize: '12px', color: '#6b7280', margin: '0', lineHeight: '1.5' }}>
                Showing 50 of {totalMonitored} monitored emails.{' '}
                <span style={{ color: '#374151', fontWeight: '500' }}>
                  {hiddenCount} older emails are not shown.
                </span>{' '}
                Run{' '}
                <span style={{ color: '#0d9488', fontWeight: '500', cursor: 'pointer' }}>
                  Scan & Clean
                </span>{' '}
                to classify and review all of them in your inbox report.
              </p>
            ) : hasMore ? (
              // Load more available
              <button
                onClick={() => loadEmails(page + 1)}
                disabled={loadingMore}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '12px',
                  color: loadingMore ? '#9ca3af' : '#0d9488',
                  cursor: loadingMore ? 'not-allowed' : 'pointer',
                  padding: '0',
                  fontWeight: '500',
                }}
              >
                {loadingMore ? 'Loading...' : `Load more · Showing ${emails.length} of ${totalMonitored}`}
              </button>
            ) : (
              // All shown, within 50
              <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0' }}>
                Showing all {emails.length} monitored email{emails.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}