'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
      padding: '32px',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        padding: '40px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        border: '1px solid #e5e7eb',
      }}>
        <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>😕</span>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0', lineHeight: '1.6' }}>
          We've been notified and will fix this shortly.
          Try refreshing the page or come back in a few minutes.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '10px 20px',
              backgroundColor: '#111827',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            style={{
              padding: '10px 20px',
              backgroundColor: '#f3f4f6',
              color: '#374151',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}