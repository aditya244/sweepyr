'use client'

import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'Try it out, see the value',
    features: [
      '100 emails cleanup/month',
      '100 emails monitoring/month',
      'All 13 categories',
      'Archive, trash & label',
      'Unsubscribe assist',
    ],
    cta: 'Get Started Free',
    ctaAction: 'signup',
    highlight: false,
    badge: null,
    dark: false,
  },
  {
    name: 'Pro',
    price: '₹99',
    period: 'per month',
    description: 'For regular inbox maintenance',
    features: [
      '500 emails cleanup/month',
      '500 emails monitoring/month',
      'All 13 categories',
      'Archive, trash & label',
      'Unsubscribe assist',
      'Monitoring add-ons available',
      'Priority support',
    ],
    cta: 'Start Pro',
    ctaAction: 'upgrade',
    highlight: false,
    badge: null,
    dark: false,
  },
  {
    name: 'Annual',
    price: '₹500',
    period: 'per year',
    description: 'Best value for committed cleaners',
    features: [
      '10,000 cleanup credits/year',
      '500 emails monitoring/month',
      'All 13 categories',
      'Archive, trash & label',
      'Unsubscribe assist',
      'Monitoring add-ons available',
      'Priority support',
      'Save ₹688 vs monthly',
    ],
    cta: 'Get Annual',
    ctaAction: 'upgrade',
    highlight: true,
    badge: 'Best Value',
    dark: true,
  },
  {
    name: 'Deep Clean',
    price: '₹299',
    period: 'one-time',
    description: 'For the big inbox purge',
    features: [
      'Up to 50,000 emails',
      'One-time full inbox cleanup',
      'All 13 categories',
      'Archive, trash & label',
      'Unsubscribe assist',
      'No subscription needed',
    ],
    cta: 'Get Deep Clean',
    ctaAction: 'upgrade',
    highlight: false,
    badge: 'One-time',
    dark: false,
  },
]

const ADD_ONS = [
  {
    name: 'Starter Boost',
    price: '₹29',
    period: 'per month',
    desc: '+2,900 monitoring emails/month',
  },
  {
    name: 'Power Boost',
    price: '₹79',
    period: 'per month',
    desc: '+10,000 monitoring emails/month',
  },
]

export default function PricingPage() {
  const { data: session } = useSession()
  const router = useRouter()

  function handleCTA(action) {
    if (action === 'signup') {
      if (session) {
        router.push('/dashboard')
      } else {
        signIn('google', { callbackUrl: '/dashboard' })
      }
    } else {
      // Phase 7 — wire up Razorpay here
      if (!session) {
        signIn('google', { callbackUrl: '/pricing' })
      } else {
        alert('Payments coming soon! We\'ll notify you when billing goes live.')
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: "0 40px",
          height: '72px', borderBottom: '1px solid #f3f4f6' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/app-icon-512.png" style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
          }} alt="Sweepyr" />
          <span style={{ fontWeight: '700', fontSize: '20px', color: '#111827' }}>Sweepyr</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="/" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>Home</a>
          {session ? (
            <button
              onClick={() => router.push('/dashboard')}
              style={{ padding: '10px 20px', backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              Go to Dashboard
            </button>
          ) : (
            <button
              onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
              style={{ padding: '10px 20px', backgroundColor: '#111827', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
            >
              Get Started Free
            </button>
          )}
        </div>
      </nav>

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '64px 32px 48px' }}>
        <h1 style={{ fontSize: '42px', fontWeight: '800', color: '#111827', margin: '0 0 12px 0', lineHeight: '1.2' }}>
          Simple, honest pricing
        </h1>
        <p style={{ fontSize: '17px', color: '#6b7280', margin: '0', lineHeight: '1.6' }}>
          Start free. Upgrade when you need more. No hidden fees.
        </p>
      </div>

      {/* Plans */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 32px 80px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', alignItems: 'start' }}>
          {PLANS.map(plan => (
            <div
              key={plan.name}
              style={{
                backgroundColor: plan.dark ? '#111827' : '#f9fafb',
                borderRadius: '16px',
                padding: '28px 24px',
                border: plan.highlight ? '2px solid #0d9488' : plan.dark ? 'none' : '1px solid #e5e7eb',
                position: 'relative',
                marginTop: plan.badge ? '16px' : '0',
              }}
            >
              {/* Badge */}
              {plan.badge && (
                <div style={{
                  position: 'absolute',
                  top: '-14px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  backgroundColor: plan.dark ? '#0d9488' : '#6b7280',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '4px 14px',
                  borderRadius: '999px',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.03em',
                }}>
                  {plan.badge}
                </div>
              )}

              {/* Plan name */}
              <h3 style={{ fontSize: '17px', fontWeight: '700', color: plan.dark ? '#fff' : '#111827', margin: '0 0 4px 0' }}>
                {plan.name}
              </h3>
              <p style={{ fontSize: '12px', color: plan.dark ? '#9ca3af' : '#6b7280', margin: '0 0 16px 0' }}>
                {plan.description}
              </p>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '24px' }}>
                <span style={{ fontSize: '36px', fontWeight: '800', color: plan.dark ? '#fff' : '#111827', lineHeight: '1' }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: '12px', color: plan.dark ? '#9ca3af' : '#6b7280' }}>
                  /{plan.period}
                </span>
              </div>

              {/* CTA */}
              <button
                onClick={() => handleCTA(plan.ctaAction)}
                style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: plan.dark ? '#0d9488' : plan.highlight ? '#111827' : '#111827',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  marginBottom: '24px',
                }}
              >
                {session && plan.ctaAction === 'signup' ? 'Go to Dashboard' : plan.cta}
              </button>

              {/* Divider */}
              <div style={{ borderTop: `1px solid ${plan.dark ? '#374151' : '#e5e7eb'}`, marginBottom: '20px' }} />

              {/* Features */}
              <ul style={{ listStyle: 'none', padding: '0', margin: '0' }}>
                {plan.features.map(f => (
                  <li key={f} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    fontSize: '13px',
                    color: plan.dark ? '#d1d5db' : '#4b5563',
                    marginBottom: '10px',
                    lineHeight: '1.4',
                  }}>
                    <span style={{ color: plan.dark ? '#2dd4bf' : '#0d9488', fontWeight: '700', flexShrink: 0, marginTop: '1px' }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Add-ons section */}
        <div style={{ marginTop: '64px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', textAlign: 'center', margin: '0 0 8px 0' }}>
            Monitoring Add-ons
          </h2>
          <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center', margin: '0 0 32px 0' }}>
            Need more monitoring? Add extra capacity on top of your Pro or Annual plan.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '560px', margin: '0 auto' }}>
            {ADD_ONS.map(addon => (
              <div
                key={addon.name}
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  padding: '24px',
                  border: '1px solid #e5e7eb',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>
                  {addon.name}
                </h3>
                <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 12px 0' }}>
                  {addon.desc}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '4px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '28px', fontWeight: '800', color: '#111827' }}>{addon.price}</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>/{addon.period}</span>
                </div>
                <button
                  onClick={() => alert('Add-on billing coming soon!')}
                  style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#111827',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Add to Plan
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ style trust section */}
        <div style={{ marginTop: '64px', textAlign: 'center' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '32px', maxWidth: '800px', margin: '0 auto' }}>
            {[
              { icon: '🔒', title: 'Privacy guaranteed', desc: 'We never read your email content. Only sender, subject and headers.' },
              { icon: '↩️', title: 'Always reversible', desc: 'Deleted emails go to Trash first. 30 days to recover anything.' },
              { icon: '❌', title: 'Cancel anytime', desc: 'No lock-in. Cancel your subscription whenever you want.' },
            ].map(item => (
              <div key={item.title}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.icon}</div>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 6px 0' }}>{item.title}</h4>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '0', lineHeight: '1.5' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #f3f4f6', padding: '32px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📬</span>
          <span style={{ fontWeight: '700', color: '#111827' }}>Sweepyr</span>
        </div>
        <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0' }}>
          Built with privacy in mind · Made in India 🇮🇳
        </p>
      </footer>

    </div>
  )
}