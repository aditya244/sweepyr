import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import {
  getAiUsageReport,
  resolveRangeStart,
  sortAiDomains,
  formatReportAsCsv,
  formatReportAsText,
} from '../../../../lib/aiUsageReport'

// Same comma-separated env var convention as TESTER_EMAILS/ADMIN_EMAILS
// in authOptions.js and app/admin/ai-usage/page.js.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export async function GET(request) {
  const session = await getServerSession(authOptions)
  const email = (session?.user?.email || '').toLowerCase()

  if (!session || !ADMIN_EMAILS.includes(email)) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const range = ['daily', 'weekly', 'monthly'].includes(searchParams.get('range'))
    ? searchParams.get('range')
    : 'all'
  const format = searchParams.get('format') === 'txt' ? 'txt' : 'csv'
  // Mirrors the sort toggle on /admin/ai-usage, so a download matches the
  // ordering of the table it was downloaded from.
  const sort = searchParams.get('sort') === 'agreement' ? 'agreement' : 'hits'

  await connectDB()
  const report = await getAiUsageReport(resolveRangeStart(range))
  report.aiDomains = sortAiDomains(report.aiDomains, sort)

  const body = format === 'txt' ? formatReportAsText(report, range) : formatReportAsCsv(report, range)
  const contentType = format === 'txt' ? 'text/plain' : 'text/csv'

  return new Response(body, {
    headers: {
      'Content-Type': `${contentType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="sweepyr-ai-usage-${range}.${format}"`,
    },
  })
}
