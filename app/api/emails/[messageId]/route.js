import { getServerSession } from 'next-auth'
import { authOptions } from '../../../../lib/authOptions'
import connectDB from '../../../../lib/mongoose'
import User from '../../../../models/User'
import Email from '../../../../models/Email'

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Await params before accessing its properties — required in Next.js 15
  const { messageId } = await params

  try {
    await connectDB()

    const user = await User.findOne({ googleId: session.user.id })
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const { category } = await request.json()

    const email = await Email.findOneAndUpdate(
      { messageId: messageId, userId: user._id },
      {
        category,
        classificationSource: 'user',
        // Durable record of the correction. `category` alone can't carry
        // it — a later archive/trash nulls that field, which would leave
        // only classificationSource: 'user' behind: enough to know a human
        // disagreed with the classifier, but not what they said instead.
        // Paired with classifiedAs (set at classify time and never
        // overwritten), this is what lets the AI usage report show
        // "classifier said X, users corrected it to Y, N times".
        correctedAs: {
          category,
          at: new Date(),
        },
      },
      { new: true }
    )

    if (!email) {
      return Response.json({ error: 'Email not found' }, { status: 404 })
    }

    return Response.json({ success: true, email })

  } catch (error) {
    console.error('Error updating email:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }
}