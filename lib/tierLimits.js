// Single source of truth for monthly cleanup limits and the lazy usage
// reset. Used by both /api/gmail/process (enforcement + metering) and
// /api/user/status (read-only display), so the two never disagree.

export const TIER_LIMITS = {
  free: 100,
  pro: 500,
  annual: 10000, // credit pool — matches pricing page ("10,000 cleanup credits/year")
  deepclean: 5000,
}

export function getCleanupLimit(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free
}

const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // lazy 30-day rolling reset

// Resets usage.cleanupCount if more than 30 days have passed since resetAt.
// Mutates and saves the user doc when a reset happens, so every caller sees
// consistent numbers without needing a cron job.
export async function ensureFreshUsage(user) {
  const resetAt = user.usage?.resetAt ? new Date(user.usage.resetAt) : new Date(0)
  const expired = Date.now() - resetAt.getTime() > RESET_INTERVAL_MS

  if (expired) {
    user.usage.cleanupCount = 0
    user.usage.resetAt = new Date()
    await user.save()
  }

  return user
}
