import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import { getEmailCount, isAuthError } from '../../../../lib/gmail';
import { logError } from '../../../../lib/logger'

export async function GET() {
  // Check the user is logged in
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await connectDB()

    // Get their refresh token from MongoDB
    const user = await User.findOne({ googleId: session.user.id })
    if (!user?.refreshToken) {
      return Response.json({ error: 'No refresh token found' }, { status: 400 })
    }

    const count = await getEmailCount(user.refreshToken)
    return Response.json({ count })
    
    } catch (error) {
      logError(error, {
      route: '/api/gmail/count',
      userId: session?.user?.id,
    })

    if (error.code === 'GMAIL_AUTH_EXPIRED') {
      return Response.json(
        { error: 'GMAIL_AUTH_EXPIRED', action: 'RECONNECT' },
        { status: 401 }
      )
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
}