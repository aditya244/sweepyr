// Single source of truth for monthly cleanup limits and the lazy usage
// reset. Used by both /api/gmail/process (enforcement + metering) and
// /api/user/status (read-only display), so the two never disagree.

export const TIER_LIMITS = {
  free: 100,
  pro: 500,
  annual: 10000, // credit pool — matches pricing page ("10,000 cleanup credits/year")
  deepclean: 5000,
  // One-time testing-phase allocation for whitelisted friends (see
  // TESTER_EMAILS in lib/authOptions.js) — 5 credits of 200 emails each.
  // Deliberately does NOT renew monthly — see ensureFreshUsage below.
  tester: 1000,
}

export function getCleanupLimit(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free
}

// Size of one self-serve top-up, tester tier only — matches the fixed
// TIER_BATCH_OPTIONS.tester batch size in CategorySummary.js, so "1 credit"
// means the same thing everywhere it's shown.
export const TESTER_CREDIT_SIZE = 200

// Like getCleanupLimit, but tester-aware: adds any self-serve bonus credits
// on top of the base allocation. Returns the same value as getCleanupLimit
// for every other tier — this is the only place tester bonuses are read,
// so the general (non-tester) flow is untouched everywhere else.
export function getEffectiveLimit(user) {
  const base = getCleanupLimit(user.tier)
  if (user.tier !== 'tester') return base
  const bonus = (user.usage?.bonusCredits || 0) * TESTER_CREDIT_SIZE
  return base + bonus
}

// Applies to every tier, not just testers. Once net-new metering (see
// process/route.js) means a rescan of an already-processed inbox costs
// near-zero quota, there needs to be a separate guard against endless
// rescanning without ever reviewing anything — this is that guard. It's
// framed as a product nudge ("go review what you have"), not a rate limit:
// scanning more when you already have a large unreviewed pile isn't useful
// regardless of why you're doing it.
export const MAX_UNACTIONED_BACKLOG = 1000

const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // lazy 30-day rolling reset

// Resets usage.cleanupCount if more than 30 days have passed since resetAt.
// Mutates and saves the user doc when a reset happens, so every caller sees
// consistent numbers without needing a cron job.
//
// Tester tier is exempt — it's a one-time allocation for the testing phase,
// not a recurring quota, so it never auto-resets. To grant a fresh batch of
// credits, reset usage.cleanupCount manually (or change their tier and back).
export async function ensureFreshUsage(user) {
  if (user.tier === 'tester') return user

  const resetAt = user.usage?.resetAt ? new Date(user.usage.resetAt) : new Date(0)
  const expired = Date.now() - resetAt.getTime() > RESET_INTERVAL_MS

  if (expired) {
    user.usage.cleanupCount = 0
    user.usage.resetAt = new Date()
    await user.save()
  }

  return user
}
