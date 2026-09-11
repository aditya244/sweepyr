import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import Email from '../../../../models/Email'

const MAX_FEED = 50
const PAGE_SIZE = 10

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const skip = (page - 1) * PAGE_SIZE

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const totalMonitored = await Email.countDocuments({
      userId: user._id,
      source: 'monitored',
    })

    // Never serve beyond MAX_FEED
    const effectiveLimit = Math.min(PAGE_SIZE, MAX_FEED - skip)

    const emails = effectiveLimit <= 0 ? [] : await Email.find({
      userId: user._id,
      source: 'monitored',
    })
      .sort({ monitoredAt: -1 })
      .skip(skip)
      .limit(effectiveLimit)
      .select('messageId from subject date category confidence hasAttachment monitoredAt actionTaken')

    return Response.json({
      emails,
      totalMonitored,
      page,
      hasMore: skip + emails.length < Math.min(totalMonitored, MAX_FEED),
      hiddenCount: Math.max(0, totalMonitored - MAX_FEED),
    })

  } catch (error) {
    console.error('Monitored emails error:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}