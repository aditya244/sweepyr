'use client'

import { signIn } from 'next-auth/react'

export default function ReconnectBanner({ onDismiss }) {
  return (
    <div style={{
      backgroundColor: '#fef3c7',
      border: '1px solid #fcd34d',
      borderRadius: '12px',
      padding: '16px 20px',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '20px' }}>⚠️</span>
        <div>
          <p style={{
            margin: '0 0 2px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#92400e',
          }}>
            Gmail connection expired
          </p>
          <p style={{
            margin: '0',
            fontSize: '13px',
            color: '#b45309',
            lineHeight: '1.5',
          }}>
            Your Gmail access has expired. Reconnect to continue scanning and managing emails.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={onDismiss}
          style={{
            padding: '8px 14px',
            fontSize: '13px',
            backgroundColor: 'transparent',
            border: '1px solid #fcd34d',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#92400e',
          }}
        >
          Dismiss
        </button>
        <button
          onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
          style={{
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: '#d97706',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Reconnect Gmail
        </button>
      </div>
    </div>
  )
}