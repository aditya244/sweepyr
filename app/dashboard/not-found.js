import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '40px', display: 'block', marginBottom: '16px' }}>📭</span>
        <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 8px 0' }}>
          Page not found
        </h2>
        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 24px 0' }}>
          This page doesn't exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          style={{
            padding: '10px 20px',
            backgroundColor: '#111827',
            color: '#ffffff',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            textDecoration: 'none',
          }}
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}