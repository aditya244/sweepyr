import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import Email from '../../../../models/Email'
import ActionHistory from '../../../../models/ActionHistory'
import { archiveEmails, trashEmails, getOrCreateLabel, applyLabel } from '../../../../lib/gmailActions'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action, messageId, category } = await request.json()

  if (!['archive', 'trash', 'label'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })
    if (!user?.refreshToken) {
      return Response.json({ error: 'No refresh token' }, { status: 400 })
    }

    if (action === 'archive') {
      await archiveEmails(user.refreshToken, [messageId])
    } else if (action === 'trash') {
      await trashEmails(user.refreshToken, [messageId])
    } else if (action === 'label') {
      const labelId = await getOrCreateLabel(user.refreshToken, `Sweepyr/${category}`)
      await applyLabel(user.refreshToken, [messageId], labelId)
    }

    // Save to action history
    await ActionHistory.create({
      userId: user._id,
      action,
      category: category || 'Unknown',
      emailCount: 1,
      messageIds: [messageId],
    })

    // Update email in MongoDB
    await Email.findOneAndUpdate(
      { userId: user._id, messageId },
      { $set: { actionTaken: action, category: null, isProcessed: false } }
    )

    return Response.json({ success: true })

  } catch (error) {
    logError(error, {
    route: '/api/emails/feed-action',
    userId: session?.user?.id,
    action,
    messageId,
  })
  if (error.code === 'GMAIL_AUTH_EXPIRED') {
    return Response.json({ error: 'GMAIL_AUTH_EXPIRED', action: 'RECONNECT' }, { status: 401 })
  }
    return Response.json({ error: error.message }, { status: 500 })
  }
}