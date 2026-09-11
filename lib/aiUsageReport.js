import Email from '../models/Email'

// Same extraction convention already used in lib/classifier/rules.js and
// lib/classifier/domain.js — kept independent here rather than imported,
// since this is a reporting concern, not classification logic.
function extractDomain(fromHeader) {
  if (!fromHeader) return null
  const match = fromHeader.match(/@([^>>\s]+)/)
  return match ? match[1].toLowerCase() : null
}

// Domain grouping is done in JS, not a Mongo aggregation pipeline — the
// `from` header needs the same regex extraction the classifier uses
// ("Name" <email@domain.com> vs bare email@domain.com), which is awkward
// and fragile to replicate as Mongo pipeline string operators. Fine
// performance-wise for a reporting feature, not a hot path.
export async function getAiUsageReport() {
  const bySourceAgg = await Email.aggregate([
    { $match: { classificationSource: { $ne: null } } },
    { $group: { _id: '$classificationSource', count: { $sum: 1 } } },
  ])
  const bySource = { rules: 0, domain: 0, ai: 0, user: 0 }
  bySourceAgg.forEach((r) => {
    if (r._id in bySource) bySource[r._id] = r.count
  })
  const totalClassified = Object.values(bySource).reduce((a, b) => a + b, 0)

  const aiEmails = await Email.find({ classificationSource: 'ai' })
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
