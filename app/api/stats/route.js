import { getServerSession } from 'next-auth'
import { authOptions } from '../../../lib/authOptions'
import connectDB from '../../../lib/mongoose'
import User from '../../../models/User'
import ActionHistory from '../../../models/ActionHistory'
import Email from '../../../models/Email'

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

    // Get action totals from ActionHistory
    const actions = await ActionHistory.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: '$action',
          total: { $sum: '$emailCount' },
        }
      }
    ])

    const stats = { trashed: 0, archived: 0, labelled: 0 }
    actions.forEach(a => {
      if (a._id === 'trash') stats.trashed = a.total
      if (a._id === 'archive') stats.archived = a.total
      if (a._id === 'label') stats.labelled = a.total
    })

    stats.totalCleaned = stats.trashed + stats.archived + stats.labelled

    // Get total sorted (all classified emails)
    const totalSorted = await Email.countDocuments({
      userId: user._id,
      isProcessed: true,
    })

    stats.totalSorted = totalSorted

    return Response.json({ stats })

  } catch (error) {
    console.error('Stats error:', error)
    logError(error, { route: '/api/stats', userId: session?.user?.id })
    return Response.json({ error: error.message }, { status: 500 })
  }
}