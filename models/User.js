import mongoose from 'mongoose'

// This defines the shape of a user document in MongoDB.
// refreshToken is the most important field — it's what we'll use
// in later phases to call the Gmail API on behalf of the user
// without them needing to be logged in at that moment.

const UserSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
    },
    image: {
      type: String,
    },
    refreshToken: {
      // This lets us call Gmail API in the background (queued jobs,
      // scheduled scans) even when the user isn't actively using the app.
      // In a later phase we'll encrypt this at rest.
      type: String,
    },
    tier: {
      // 'free' | 'pro' | 'power' — gates feature access
      type: String,
      default: 'free',
    },
    usage: {
      // Tracks how many emails processed this calendar month
      cleanupCount: { type: Number, default: 0 },
      monitorCount: { type: Number, default: 0 },
      resetAt: { type: Date, default: () => new Date() },
      // Self-serve top-ups, tester tier only — each unit is one extra scan
      // credit (TESTER_CREDIT_SIZE emails, see lib/tierLimits.js). Never
      // read for any other tier.
      bonusCredits: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
)

// Prevent model recompilation on hot reload (standard Next.js pattern)
export default mongoose.models.User || mongoose.model('User', UserSchema)