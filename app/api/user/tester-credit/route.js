import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import { logError } from '../../../../lib/logger'

// Self-serve top-up, tester tier only. No approval gate by design - this
// is for a small group of whitelisted testing-phase friends, not a public
// billing mechanism. See lib/tierLimits.js's getEffectiveLimit() for how
// this is actually applied to the quota.
export async function POST() {
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

    if (user.tier !== 'tester') {
      return Response.json({ error: 'Only available on the tester tier' }, { status: 403 })
    }

    user.usage.bonusCredits = (user.usage.bonusCredits || 0) + 1
    await user.save()

    return Response.json({ success: true, bonusCredits: user.usage.bonusCredits })

  } catch (error) {
    logError(error, { route: '/api/user/tester-credit', userId: session?.user?.id })
    return Response.json({ error: error.message }, { status: 500 })
  }
}
