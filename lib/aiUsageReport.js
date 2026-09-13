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

// Bar a domain must clear before it's worth hardcoding into KNOWN_DOMAINS.
// Hits guards against promoting off a handful of emails from one tester's
// inbox; agreement guards against promoting a domain whose mail genuinely
// splits across categories (where a flat rule would be wrong by design).
// Deliberately conservative — a bad rule misclassifies that sender for
// every future user, silently, until someone notices.
export const PROMOTION_MIN_HITS = 20
export const PROMOTION_MIN_AGREEMENT = 90

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

// Every read below prefers the immutable `classifiedAs` snapshot and falls
// back to the live field. The fallback exists for emails classified before
// classifiedAs was added — without it, switching to the snapshot would blank
// the whole report until every tester rescanned. The fallback is lossy in
// exactly the ways classifiedAs exists to fix (a live `category` is null once
// the user acts on it), so these numbers get more accurate over time as
// pre-snapshot emails age out of the selected range.
const EFFECTIVE_SOURCE = { $ifNull: ['$classifiedAs.source', '$classificationSource'] }

// Prefers the real classification timestamp. `updatedAt` is only a fallback
// because it tracks the last *touch* — archiving an email months after it was
// classified moves it into the "last 24 hours" bucket, which is precisely the
// distortion classifiedAs.at removes.
function buildDateMatch(since) {
  if (!since) return {}
  return { $expr: { $gte: [{ $ifNull: ['$classifiedAs.at', '$updatedAt'] }, since] } }
}

// Sorting is a view concern, so it's applied after aggregation rather than in
// Mongo — the domain list is small (one row per distinct sender domain) and
// already fully materialised in memory by the grouping below.
export function sortAiDomains(domains, sort) {
  const rows = [...domains]
  if (sort === 'agreement') {
    // Ties on agreement (100% is common at low volume) break by hits, so the
    // rows worth acting on first sit above one-email domains that are
    // trivially "100% consistent".
    return rows.sort((a, b) => b.agreement - a.agreement || b.count - a.count)
  }
  return rows.sort((a, b) => b.count - a.count)
}

export async function getAiUsageReport(since = null) {
  const dateMatch = buildDateMatch(since)

  const bySourceAgg = await Email.aggregate([
    { $match: { ...dateMatch } },
    { $group: { _id: EFFECTIVE_SOURCE, count: { $sum: 1 } } },
  ])
  const bySource = { rules: 0, domain: 0, ai: 0, user: 0 }
  bySourceAgg.forEach((r) => {
    if (r._id in bySource) bySource[r._id] = r.count
  })
  const totalClassified = Object.values(bySource).reduce((a, b) => a + b, 0)

  // Domain grouping is done in JS, not a Mongo aggregation pipeline — the
  // `from` header needs the same regex extraction the classifier uses
  // ("Name" <email@domain.com> vs bare email@domain.com), which is awkward
  // and fragile to replicate as Mongo pipeline string operators. Fine
  // performance-wise for a reporting feature, not a hot path.
  const aiEmails = await Email.find({
    ...dateMatch,
    $or: [
      { 'classifiedAs.source': 'ai' },
      // Pre-snapshot emails: only the live field can identify them, and only
      // while nothing has since overwritten it (a reclassify sets it to
      // 'user'). Those are unrecoverable — they predate classifiedAs.
      { 'classifiedAs.source': null, classificationSource: 'ai' },
    ],
  })
    .select('from category confidence classifiedAs')
    .lean()

  const domainStats = {}
  for (const email of aiEmails) {
    const domain = extractDomain(email.from) || '(unknown)'
    const category = email.classifiedAs?.category || email.category || '(unknown)'
    const confidence = email.classifiedAs?.confidence ?? email.confidence

    if (!domainStats[domain]) {
      domainStats[domain] = { count: 0, categories: {}, confidenceSum: 0, confidenceN: 0 }
    }
    const stat = domainStats[domain]
    stat.count++
    stat.categories[category] = (stat.categories[category] || 0) + 1
    if (typeof confidence === 'number') {
      stat.confidenceSum += confidence
      stat.confidenceN++
    }
  }

  const aiTotal = bySource.ai
  const aiDomains = Object.entries(domainStats).map(([domain, stat]) => {
    // Majority category + how much of the domain's volume agrees with it.
    // Agreement is the number that decides whether a flat KNOWN_DOMAINS
    // entry would be right most of the time or actively harmful: at 100%
    // the domain only ever sends one kind of mail, at 55% a flat rule would
    // misclassify nearly half of it.
    const sorted = Object.entries(stat.categories).sort((a, b) => b[1] - a[1])
    const [topCategory, topCount] = sorted[0]
    const agreement = Math.round((topCount / stat.count) * 1000) / 10

    return {
      domain,
      count: stat.count,
      pctOfAi: aiTotal > 0 ? Math.round((stat.count / aiTotal) * 1000) / 10 : 0,
      topCategory,
      agreement,
      categoryCount: sorted.length,
      avgConfidence:
        stat.confidenceN > 0
          ? Math.round((stat.confidenceSum / stat.confidenceN) * 100) / 100
          : null,
      readyToPromote:
        stat.count >= PROMOTION_MIN_HITS && agreement >= PROMOTION_MIN_AGREEMENT,
    }
  })

  // Where a human overrode the classifier. Unlike the volume table above —
  // which shows where AI spend goes — this shows where the pipeline is
  // *wrong*, and in which direction. A repeated (domain, from → to) triple
  // is either a missing rule or an existing rule that's mis-mapped.
  const correctedEmails = await Email.find({
    ...dateMatch,
    'correctedAs.category': { $ne: null },
  })
    .select('from classifiedAs correctedAs')
    .lean()

  const correctionKeys = {}
  for (const email of correctedEmails) {
    const domain = extractDomain(email.from) || '(unknown)'
    const from = email.classifiedAs?.category || '(unknown)'
    const to = email.correctedAs?.category || '(unknown)'
    // Self-corrections (user "changes" a category to what it already was)
    // carry no signal about the classifier being wrong.
    if (from === to) continue
    const key = `${domain}|${from}|${to}`
    if (!correctionKeys[key]) {
      correctionKeys[key] = { domain, from, to, count: 0, source: email.classifiedAs?.source || null }
    }
    correctionKeys[key].count++
  }
  const corrections = Object.values(correctionKeys).sort((a, b) => b.count - a.count)
  const correctedTotal = corrections.reduce((sum, c) => sum + c.count, 0)

  // Default to volume order so every consumer (page, CSV, TXT) gets a sensible
  // ordering without having to ask; the page re-sorts via sortAiDomains.
  return {
    totalClassified,
    bySource,
    aiDomains: sortAiDomains(aiDomains, 'hits'),
    corrections,
    correctedTotal,
  }
}

const RANGE_LABELS = { daily: 'Last 24 hours', weekly: 'Last 7 days', monthly: 'Last 30 days', all: 'All time' }

function csvEscape(value) {
  const str = String(value)
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

export function formatReportAsCsv(report, range) {
  const { totalClassified, bySource, aiDomains, corrections } = report
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
  lines.push('Domain,AI Hits,% of AI Volume,Majority Category,Agreement %,Categories Seen,Avg Confidence,Ready To Promote')
  aiDomains.forEach((d) => {
    lines.push(
      [
        csvEscape(d.domain),
        d.count,
        d.pctOfAi,
        csvEscape(d.topCategory),
        d.agreement,
        d.categoryCount,
        d.avgConfidence ?? '',
        d.readyToPromote ? 'yes' : 'no',
      ].join(',')
    )
  })
  lines.push('')
  lines.push('Domain,Classified As,Corrected To,Count')
  corrections.forEach((c) => {
    lines.push([csvEscape(c.domain), csvEscape(c.from), csvEscape(c.to), c.count].join(','))
  })
  return lines.join('\n') + '\n'
}

export function formatReportAsText(report, range) {
  const { totalClassified, bySource, aiDomains, corrections, correctedTotal } = report
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
  lines.push(`Promotion bar: >=${PROMOTION_MIN_HITS} hits and >=${PROMOTION_MIN_AGREEMENT}% agreement`)
  lines.push('-------------------------------------------')
  if (aiDomains.length === 0) {
    lines.push('(none)')
  } else {
    aiDomains.forEach((d) => {
      const flag = d.readyToPromote ? ' *' : '  '
      lines.push(
        `${flag}${d.domain.padEnd(33)} ${String(d.count).padStart(5)} hits  ` +
          `${String(d.agreement).padStart(5)}% -> ${String(d.topCategory).padEnd(16)} ` +
          `conf ${d.avgConfidence ?? '-'}`
      )
    })
  }
  lines.push('')
  lines.push(`User corrections (${correctedTotal})`)
  lines.push('-------------------------------------------')
  if (corrections.length === 0) {
    lines.push('(none)')
  } else {
    corrections.forEach((c) => {
      lines.push(`${c.domain.padEnd(35)} ${c.from} -> ${c.to}  (${c.count})`)
    })
  }
  return lines.join('\n') + '\n'
}
