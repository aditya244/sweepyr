import Email from '../models/Email'

// Same extraction convention already used in lib/classifier/rules.js and
// lib/classifier/domain.js — kept independent here rather than imported,
// since this is a reporting concern, not classification logic.
function extractDomain(fromHeader) {
  if (!fromHeader) return null
  const match = fromHeader.match(/@([^>>\s]+)/)
  return match ? match[1].toLowerCase() : null
}

const DAY_MS = 24 * 60 * 60 * 1000

// 'daily'/'weekly'/'monthly' are rolling windows (last 24h/7d/30d), not
// calendar-boundary periods — avoids timezone edge cases for what's meant
// to be a rough trend view, not billing-grade precision. Returns null for
// 'all' (or anything unrecognized), meaning no date filter.
export function resolveRangeStart(range) {
  const now = Date.now()
  if (range === 'daily') return new Date(now - DAY_MS)
  if (range === 'weekly') return new Date(now - 7 * DAY_MS)
  if (range === 'monthly') return new Date(now - 30 * DAY_MS)
  return null
}

// Domain grouping is done in JS, not a Mongo aggregation pipeline — the
// `from` header needs the same regex extraction the classifier uses
// ("Name" <email@domain.com> vs bare email@domain.com), which is awkward
// and fragile to replicate as Mongo pipeline string operators. Fine
// performance-wise for a reporting feature, not a hot path.
//
// Date filtering uses updatedAt as a proxy for "when was this classified" —
// there's no dedicated classification timestamp, but updatedAt is set when
// the classification stage writes category/confidence/classificationSource,
// so in practice it's a close match.
export async function getAiUsageReport(since = null) {
  const dateMatch = since ? { updatedAt: { $gte: since } } : {}

  const bySourceAgg = await Email.aggregate([
    { $match: { classificationSource: { $ne: null }, ...dateMatch } },
    { $group: { _id: '$classificationSource', count: { $sum: 1 } } },
  ])
  const bySource = { rules: 0, domain: 0, ai: 0, user: 0 }
  bySourceAgg.forEach((r) => {
    if (r._id in bySource) bySource[r._id] = r.count
  })
  const totalClassified = Object.values(bySource).reduce((a, b) => a + b, 0)

  const aiEmails = await Email.find({ classificationSource: 'ai', ...dateMatch })
    .select('from')
    .lean()

  const domainCounts = {}
  for (const email of aiEmails) {
    const domain = extractDomain(email.from) || '(unknown)'
    domainCounts[domain] = (domainCounts[domain] || 0) + 1
  }

  const aiTotal = bySource.ai
  const aiDomains = Object.entries(domainCounts)
    .map(([domain, count]) => ({
      domain,
      count,
      pctOfAi: aiTotal > 0 ? Math.round((count / aiTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return { totalClassified, bySource, aiDomains }
}

const RANGE_LABELS = { daily: 'Last 24 hours', weekly: 'Last 7 days', monthly: 'Last 30 days', all: 'All time' }

function csvEscape(value) {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function formatReportAsCsv(report, range) {
  const { totalClassified, bySource, aiDomains } = report
  const lines = []
  lines.push(`# Sweepyr AI Usage Report`)
  lines.push(`# Range: ${RANGE_LABELS[range] || range}`)
  lines.push(`# Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('Classification Source,Count,% of Total')
  const pct = (n) => (totalClassified > 0 ? Math.round((n / totalClassified) * 1000) / 10 : 0)
  lines.push(`Rules,${bySource.rules},${pct(bySource.rules)}`)
  lines.push(`Domain,${bySource.domain},${pct(bySource.domain)}`)
  lines.push(`AI,${bySource.ai},${pct(bySource.ai)}`)
  lines.push(`User-corrected,${bySource.user},${pct(bySource.user)}`)
  lines.push('')
  lines.push('Domain,AI Hits,% of AI Volume')
  aiDomains.forEach((d) => {
    lines.push(`${csvEscape(d.domain)},${d.count},${d.pctOfAi}`)
  })
  return lines.join('\n') + '\n'
}

export function formatReportAsText(report, range) {
  const { totalClassified, bySource, aiDomains } = report
  const pct = (n) => (totalClassified > 0 ? Math.round((n / totalClassified) * 1000) / 10 : 0)
  const lines = []
  lines.push('Sweepyr AI Usage Report')
  lines.push(`Range: ${RANGE_LABELS[range] || range}`)
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push('')
  lines.push('Classification Source Split')
  lines.push('----------------------------')
  lines.push(`Rules:           ${String(bySource.rules).padStart(6)}  (${pct(bySource.rules)}%)`)
  lines.push(`Domain:          ${String(bySource.domain).padStart(6)}  (${pct(bySource.domain)}%)`)
  lines.push(`AI:              ${String(bySource.ai).padStart(6)}  (${pct(bySource.ai)}%)`)
  lines.push(`User-corrected:  ${String(bySource.user).padStart(6)}  (${pct(bySource.user)}%)`)
  lines.push(`Total:           ${String(totalClassified).padStart(6)}`)
  lines.push('')
  lines.push(`Domains hitting the AI layer (${aiDomains.length})`)
  lines.push('-------------------------------------------')
  if (aiDomains.length === 0) {
    lines.push('(none)')
  } else {
    aiDomains.forEach((d) => {
      lines.push(`${d.domain.padEnd(35)} ${String(d.count).padStart(5)} hits  (${d.pctOfAi}%)`)
    })
  }
  return lines.join('\n') + '\n'
}
