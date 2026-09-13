import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '../../../lib/authOptions'
import connectDB from '../../../lib/mongoose'
import {
  getAiUsageReport,
  resolveRangeStart,
  sortAiDomains,
  PROMOTION_MIN_HITS,
  PROMOTION_MIN_AGREEMENT,
} from '../../../lib/aiUsageReport'

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

// Volume answers "where is the AI spend going", agreement answers "what can I
// safely hardcode next" — different jobs, so neither ordering is the right
// default for both.
const SORTS = [
  { key: 'hits', label: 'AI hits' },
  { key: 'agreement', label: 'Agreement' },
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
  const sort = SORTS.some((s) => s.key === params?.sort) ? params.sort : 'hits'

  await connectDB()
  const report = await getAiUsageReport(resolveRangeStart(range))
  const { totalClassified, bySource, corrections, correctedTotal } = report
  const aiDomains = sortAiDomains(report.aiDomains, sort)
  const promotable = aiDomains.filter((d) => d.readyToPromote).length

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
        Every domain below is one <code>KNOWN_DOMAINS</code> doesn't handle yet. Volume shows where
        AI spend goes; agreement shows which domains a flat rule would actually get right.
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
              href={`/admin/ai-usage?range=${r.key}&sort=${sort}`}
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
            href={`/api/admin/ai-usage-export?range=${range}&sort=${sort}&format=csv`}
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
            href={`/api/admin/ai-usage-export?range=${range}&sort=${sort}&format=txt`}
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
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '4px',
      }}>
        <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '0' }}>
          Domains hitting the AI layer ({aiDomains.length})
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', color: '#9ca3af' }}>Sort by</span>
          {SORTS.map((s) => (
            <a
              key={s.key}
              href={`/admin/ai-usage?range=${range}&sort=${s.key}`}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: '500',
                textDecoration: 'none',
                borderRadius: '6px',
                color: sort === s.key ? '#0d9488' : '#6b7280',
                backgroundColor: sort === s.key ? '#f0fdfa' : '#f9fafb',
                border: sort === s.key ? '1px solid #5eead4' : '1px solid #e5e7eb',
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '0', marginBottom: '12px' }}>
        Highlighted rows clear the promotion bar (≥{PROMOTION_MIN_HITS} hits, ≥
        {PROMOTION_MIN_AGREEMENT}% agreement) — {promotable} of {aiDomains.length} ready to add to{' '}
        <code>KNOWN_DOMAINS</code>. Check a domain isn&apos;t already in the attachment-sensitive
        lists before adding it.
      </p>

      {aiDomains.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>No AI-classified emails in this range.</p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Domain</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>AI hits</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>% of AI</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Majority category</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Agreement</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Avg conf.</th>
              </tr>
            </thead>
            <tbody>
              {aiDomains.map((d) => (
                <tr
                  key={d.domain}
                  style={{
                    borderTop: '1px solid #f3f4f6',
                    backgroundColor: d.readyToPromote ? '#f0fdfa' : 'transparent',
                  }}
                >
                  <td style={{ padding: '10px 14px', color: '#111827', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {d.readyToPromote && (
                      <span style={{ color: '#0d9488', fontWeight: '700', marginRight: '6px' }}>✓</span>
                    )}
                    {d.domain}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{d.count}</td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{d.pctOfAi}%</td>
                  <td style={{ padding: '10px 14px', color: '#374151', whiteSpace: 'nowrap' }}>
                    {d.topCategory}
                    {d.categoryCount > 1 && (
                      <span style={{ color: '#9ca3af', fontSize: '11px', marginLeft: '6px' }}>
                        +{d.categoryCount - 1} other
                      </span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '10px 14px',
                      fontWeight: '600',
                      // Colour tracks how safe a flat rule would be, not rank —
                      // a low-agreement domain is a warning regardless of volume.
                      color:
                        d.agreement >= PROMOTION_MIN_AGREEMENT
                          ? '#0f766e'
                          : d.agreement >= 70
                            ? '#d97706'
                            : '#dc2626',
                    }}
                  >
                    {d.agreement}%
                  </td>
                  <td style={{ padding: '10px 14px', color: '#6b7280' }}>{d.avgConfidence ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* User corrections — where the pipeline is wrong, not just expensive */}
      <h2 style={{ fontSize: '15px', fontWeight: '600', color: '#111827', margin: '40px 0 4px 0' }}>
        User corrections ({correctedTotal})
      </h2>
      <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '0', marginBottom: '12px' }}>
        Where a human overrode the classifier. A repeating row is either a missing rule or an
        existing one mapped to the wrong category.
      </p>

      {corrections.length === 0 ? (
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          No corrections recorded in this range. Only reclassifications made after the
          <code> correctedAs </code> field shipped are captured.
        </p>
      ) : (
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb', textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Domain</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Classified as</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Corrected to</th>
                <th style={{ padding: '10px 14px', fontWeight: '600', color: '#374151' }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((c) => (
                <tr key={`${c.domain}|${c.from}|${c.to}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 14px', color: '#111827', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {c.domain}
                  </td>
                  <td style={{ padding: '10px 14px', color: '#dc2626' }}>{c.from}</td>
                  <td style={{ padding: '10px 14px', color: '#0f766e', fontWeight: '600' }}>{c.to}</td>
                  <td style={{ padding: '10px 14px', color: '#374151' }}>{c.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
