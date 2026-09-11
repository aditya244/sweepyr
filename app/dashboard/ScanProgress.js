'use client'

export default function ScanProgress({ stage, message, percent, progress, total }) {
  const stageLabels = {
    scanning: 'Scanning',
    classifying: 'Classifying',
    done: 'Complete',
  }

  return (
    <div style={{
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      padding: '20px',
      border: '1px solid #e5e7eb',
      marginBottom: '16px',
    }}>
      {/* Stage indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {percent < 100 ? (
            <div style={{
              width: '14px',
              height: '14px',
              border: '2px solid #e5e7eb',
              borderTopColor: '#0d9488',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }} />
          ) : (
            <span style={{ fontSize: '14px' }}>✅</span>
          )}
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>
            {stageLabels[stage] || 'Processing'}
          </span>
        </div>
        <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
          {percent}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', backgroundColor: '#e5e7eb', borderRadius: '999px', height: '6px', marginBottom: '10px' }}>
        <div style={{
          width: `${percent}%`,
          backgroundColor: percent === 100 ? '#16a34a' : '#0d9488',
          height: '6px',
          borderRadius: '999px',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Detail line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{message}</span>
        {progress > 0 && total > 0 && (
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>
            {progress.toLocaleString()} / {total.toLocaleString()}
          </span>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}