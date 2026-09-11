import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import Email from '../../../../models/Email'
import ActionHistory from '../../../../models/ActionHistory'
import {
  archiveEmails,
  trashEmails,
  applyLabel,
  getOrCreateLabel,
} from '../../../../lib/gmailActions'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { action, category } = await request.json()

  // Validate action type
  if (!['archive', 'trash', 'label'].includes(action)) {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })
    if (!user?.refreshToken) {
      return Response.json({ error: 'No refresh token found' }, { status: 400 })
    }

    // Fetch all emails in this category for this user
    const emails = await Email.find({
      userId: user._id,
      category,
    }).select('messageId')

    if (emails.length === 0) {
      return Response.json({ error: 'No emails found in this category' }, { status: 404 })
    }

    const messageIds = emails.map(e => e.messageId)
    let result = 0

    // Execute the action
    if (action === 'archive') {
      result = await archiveEmails(user.refreshToken, messageIds)

    } else if (action === 'trash') {
      result = await trashEmails(user.refreshToken, messageIds)

    } else if (action === 'label') {
      const labelName = `Sweepyr/${category}`
      const labelId = await getOrCreateLabel(user.refreshToken, labelName)
      result = await applyLabel(user.refreshToken, messageIds, labelId)
    }

    // Save action history
    await ActionHistory.create({
      userId: user._id,
      action,
      category,
      emailCount: result,
      labelName: action === 'label' ? `Sweepyr/${category}` : undefined,
      messageIds,
    })

    // Mark emails as processed with the action taken
    // Mark emails with action taken AND clear their category
// so they don't appear in the category list anymore
await Email.updateMany(
  { userId: user._id, category },
  {
    $set: {
      actionTaken: action,
      category: null,
      isProcessed: false,
    }
  }
)

    return Response.json({
      success: true,
      action,
      category,
      affected: result,
    })

  } catch (error) {
    logError(error, {
    route: '/api/emails/actions',
    userId: session?.user?.id,
    action,
    category,
  })
  if (error.code === 'GMAIL_AUTH_EXPIRED') {
    return Response.json({ error: 'GMAIL_AUTH_EXPIRED', action: 'RECONNECT' }, { status: 401 })
  }
    return Response.json({ error: error.message }, { status: 500 })
  }
}