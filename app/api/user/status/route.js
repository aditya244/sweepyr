import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import Email from '../../../../models/Email'
import { logError } from '../../../../lib/logger'
import { getCleanupLimit, ensureFreshUsage } from '../../../../lib/tierLimits'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    await ensureFreshUsage(user)
    const tier = user.tier || 'free'
    const limit = getCleanupLimit(tier)
    const used = user.usage?.cleanupCount || 0

    // Check if user has any processed exails
    const processedCount = await Email.countDocuments({
      userId: user._id,
      isProcessed: true,
    })

    // Check if user has any emails at all
    const totalCount = await Email.countDocuments({
      userId: user._id,
    })

    return Response.json({
      isNewUser: processedCount === 0,
      hasScanned: totalCount > 0,
      hasClassified: processedCount > 0,
      tier,
      usage: { used, limit, remaining: Math.max(0, limit - used) },
      memberSince: user.createdAt,
    })

  } catch (error) {
    logError(error, { route: '/api/user/status', userId: session?.user?.id })
    return Response.json({ error: error.message }, { status: 500 })
  }
}