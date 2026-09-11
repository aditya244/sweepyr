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

  const { action, messageIds, category } = await request.json()

  if (!['archive', 'trash', 'label'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  if (!messageIds || messageIds.length === 0) {
    return Response.json({ error: 'No message IDs provided' }, { status: 400 })
  }

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })
    if (!user?.refreshToken) {
      return Response.json({ error: 'No refresh token found' }, { status: 400 })
    }

    let result = 0

    if (action === 'archive') {
      result = await archiveEmails(user.refreshToken, messageIds)
    } else if (action === 'trash') {
      result = await trashEmails(user.refreshToken, messageIds)
    } else if (action === 'label') {
      const labelId = await getOrCreateLabel(user.refreshToken, `Sweepyr/${category}`)
      result = await applyLabel(user.refreshToken, messageIds, labelId)
    }

    // Save action history
    await ActionHistory.create({
      userId: user._id,
      action,
      category,
      emailCount: result,
      messageIds,
    })

    // Update emails in MongoDB
    await Email.updateMany(
      { userId: user._id, messageId: { $in: messageIds } },
      { $set: { actionTaken: action, category: null, isProcessed: false } }
    )

    return Response.json({ success: true, affected: result })

  } catch (error) {
    logError(error, {
      route: '/api/emails/group-action',
      userId: session?.user?.id,
      action,
      domain,
    })
    if (error.code === 'GMAIL_AUTH_EXPIRED') {
      return Response.json({ error: 'GMAIL_AUTH_EXPIRED', action: 'RECONNECT' }, { status: 401 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
}