import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '../../../lib/authOptions'
import connectDB from '../../../lib/mongoose'
import { getAiUsageReport, resolveRangeStart } from '../../../lib/aiUsageReport'

// Same comma-separated env var convention as TESTER_EMAILS in authOptions.js
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

const RANGES = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'all', label: 'All time' },
]

export default async function AiUsagePage({ searchParams }) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').toLowerCase()

  if (!session || !ADMIN_EMAILS.includes(email)) {
    redirect('/')
  }

  // searchParams is a Promise in Next.js 15+ page components
  const params = await searchParams
  const range = RANGES.some((r) => r.key === params?.range) ? params.range : 'all'

  await connectDB()
  const { totalClassified, bySource, aiDomains } = await getAiUsageReport(resolveRangeStart(range))

  const pct = (n) => (totalClassified > 0 ? Math.round((n / totalClassified) * 1000) / 10 : 0)

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '40px 24px 80px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
        AI Usage Report
      </h1>
      <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '24px' }}>
        Any domain below is one <code>KNOWN_DOMAINS</code> doesn't handle yet — a large % here is
        a candidate for a new rule.
      </p>

      {/* Range tabs + download */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '32px',
      }}>
        <div style={{ display: 'flex', gap: '4px' }}>
          {RANGES.map((r) => (
            <a
              key={r.key}
              href={`/admin/ai-usage?range=${r.key}`}
              style={{
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: '500',
                textDecoration: 'none',
                borderRadius: '8px',
                color: range === r.key ? '#0d9488' : '#6b7280',
                backgroundColor: range === r.key ? '#f0fdfa' : '#f9fafb',
                border: range === r.key ? '1px solid #5eead4' : '1px solid #e5e7eb',
              }}
            >
              {r.label}
            </a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <a
            href={`/api/admin/ai-usage-export?range=${range}&format=csv`}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '600',
              textDecoration: 'none',
              color: '#374151',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            ⬇ CSV
          </a>
          <a
            href={`/api/admin/ai-usage-export?range=${range}&format=txt`}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '600',
              textDecoration: 'none',
              color: '#374151',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          >
            ⬇ TXT
          </a>
        </div>
      </div>

      {/* Classification source split */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '40px',
        }}
      >
        {[
          { label: 'Rules', value: bySource.rules, color: '#1d4ed8' },
          { label: 'Domain', value: bySource.domain, color: '#1d4ed8' },
          { label: 'AI', value: bySource.ai, color: '#dc2626' },
          { label: 'User-corrected', value: bySource.user, color: '#166534' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              padding: '16px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '10px',
            }}
          >
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px 0' }}>{s.label}</p>
            <p style={{ fontSize: '22px', fontWeight: '700', color: s.color, margin: '0' }}>
              {s.value.toLocaleString()}
            </p>
            <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>
              {pct(s.value)}% of {totalClassified.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* AI domain breakdown */}
      <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
        Domains hitting the AI layer ({aiDomains.length})
      </h2>

      {aiDomains.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>No AI-classified emails in this range.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Domain</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>AI hits</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>% of AI volume</th>
              </tr>
            </thead>
            <tbody>
              {aiDomains.map((d, i) => (
                <tr key={d.domain} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', color: '#111827', fontFamily: 'monospace' }}>
                    {d.domain}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{d.count}</td>
                  <td style={{ padding: '10px 14px', color: i < 3 ? '#dc2626' : '#6b7280', fontWeight: i < 3 ? '600' : '400' }}>
                    {d.pctOfAi}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
