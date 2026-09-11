'use client'

const STEPS = [
  {
    id: 1,
    label: 'Connected Gmail',
    description: 'Your Gmail is connected and ready.',
    status: 'done',
  },
  {
    id: 2,
    label: 'Scan your first emails',
    description: 'We\'ll read sender info and subject lines only — never email content.',
    status: 'current',
  },
  {
    id: 3,
    label: 'Review and take action',
    description: 'Archive, trash or label emails by category.',
    status: 'upcoming',
  },
]

export default function OnboardingWelcome({ userName, onStartScan }) {
  const firstName = userName?.split(' ')[0] || 'there'

  return (
    <div style={{
      backgroundColor: '#ffffff',
      borderRadius: '16px',
      border: '1px solid #e5e7eb',
      padding: '40px',
      marginBottom: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Background accent */}
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '300px',
        height: '300px',
        backgroundColor: '#f0fdfa',
        borderRadius: '50%',
        transform: 'translate(100px, -150px)',
        zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>👋</div>
          <h2 style={{
            fontSize: '24px',
            fontWeight: '800',
            color: '#111827',
            margin: '0 0 8px 0',
          }}>
            Welcome to Sweepyr, {firstName}!
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#6b7280',
            margin: '0',
            lineHeight: '1.6',
          }}>
            Let's clean up your inbox in three simple steps.
            It takes less than 2 minutes to get started.
          </p>
        </div>

        {/* Steps */}
        <div style={{ marginBottom: '32px' }}>
          {STEPS.map((step, index) => (
            <div
              key={step.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                marginBottom: index < STEPS.length - 1 ? '20px' : '0',
              }}
            >
              {/* Step indicator */}
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                fontWeight: '700',
                backgroundColor:
                  step.status === 'done' ? '#0d9488' :
                  step.status === 'current' ? '#111827' : '#f3f4f6',
                color:
                  step.status === 'done' ? '#ffffff' :
                  step.status === 'current' ? '#ffffff' : '#9ca3af',
                border:
                  step.status === 'current' ? '2px solid #111827' : 'none',
              }}>
                {step.status === 'done' ? '✓' : step.id}
              </div>

              {/* Step content */}
              <div style={{ paddingTop: '4px' }}>
                <p style={{
                  margin: '0 0 2px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color:
                    step.status === 'done' ? '#0d9488' :
                    step.status === 'current' ? '#111827' : '#9ca3af',
                }}>
                  {step.status === 'done' && '✓ '}{step.label}
                </p>
                <p style={{
                  margin: '0',
                  fontSize: '13px',
                  color: step.status === 'upcoming' ? '#d1d5db' : '#6b7280',
                }}>
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Privacy note */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '16px' }}>🔒</span>
          <p style={{ margin: '0', fontSize: '13px', color: '#166534', lineHeight: '1.5' }}>
            We only read sender addresses, subject lines and email headers.
            <strong> Email content is never accessed.</strong>
          </p>
        </div>

        {/* CTA */}
        <button
          onClick={onStartScan}
          style={{
            padding: '14px 32px',
            backgroundColor: '#111827',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>→</span>
          Start My First Scan
        </button>

        <p style={{
          fontSize: '12px',
          color: '#9ca3af',
          marginTop: '12px',
          marginBottom: '0',
        }}>
          Your first 100 emails are free · No credit card required
        </p>

      </div>
    </div>
  )
}