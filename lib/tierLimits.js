// Single source of truth for cleanup limits and the lazy usage resets.
// Used by both /api/gmail/process (enforcement + metering) and
// /api/user/status (read-only display), so the two never disagree.

export const TIER_LIMITS = {
  // Monthly pool. Free users draw it down at most DAILY_LIMITS.free per day,
  // so 1000 is reachable over ~10 active days rather than in one sitting —
  // the daily cap is what brings people back, the monthly pool bounds cost.
  free: 1000,
  pro: 500,
  annual: 10000, // credit pool — matches pricing page ("10,000 cleanup credits/year")
  deepclean: 5000,
  // One-time testing-phase allocation for whitelisted friends (see
  // TESTER_EMAILS in lib/authOptions.js) — 5 credits of 200 emails each.
  // Deliberately does NOT renew monthly — see ensureFreshUsage below.
  tester: 1000,
}

// Per-day cap, on top of the monthly pool. Tiers not listed have no daily cap.
// Free only, by design: paid tiers are paying precisely to not wait, and the
// tester tier already has its own credit mechanism.
//
// Enforced on scanning/classifying, never on actions. A user can always act on
// everything already sorted into their dashboard — a daily cap on archive/trash
// would half-complete a "trash this 500-email sender group" click, which is a
// broken flow rather than a limit.
export const DAILY_LIMITS = {
  free: 100,
}

export function getCleanupLimit(tier) {
  return TIER_LIMITS[tier] || TIER_LIMITS.free
}

export function getDailyLimit(tier) {
  return DAILY_LIMITS[tier] ?? null
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

// ── India Standard Time day boundaries ─────────────────────────
// The daily cap resets at midnight IST for everyone, not per-user rolling 24h:
// a fixed "new emails unlock at midnight" moment is a clearer reason to come
// back than a reset time that drifts with whenever you last scanned. IST is a
// fixed UTC+5:30 with no daylight saving, so plain offset arithmetic is exact —
// no timezone library needed.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

// 'YYYY-MM-DD' for the IST calendar day containing `date`. Stored on the user
// as usage.dailyDate; comparing day keys avoids any timestamp/timezone math at
// the point of deciding whether today's counter is stale.
export function istDayKey(date = new Date()) {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

// The next midnight IST after `date`, as a real (UTC) instant.
export function nextIstMidnight(date = new Date()) {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS)
  const nextDayUtc = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() + 1,
  )
  return new Date(nextDayUtc - IST_OFFSET_MS)
}

// Lazily resets both usage windows, so every caller sees consistent numbers
// without needing a cron job. Saves the user doc only when something changed.
//
// Daily: resets usage.dailyCount when the stored IST day isn't today. Tracked
// for every tier (cheap, and keeps the data consistent if a daily cap is ever
// added elsewhere), but only enforced for tiers in DAILY_LIMITS.
//
// Monthly: resets usage.cleanupCount if more than 30 days have passed since
// resetAt. Tester tier is exempt — it's a one-time allocation for the testing
// phase, not a recurring quota, so it never auto-resets. To grant a fresh
// batch of credits, reset usage.cleanupCount manually (or change their tier
// and back).
export async function ensureFreshUsage(user) {
  let changed = false

  const today = istDayKey()
  if (user.usage.dailyDate !== today) {
    user.usage.dailyCount = 0
    user.usage.dailyDate = today
    changed = true
  }

  if (user.tier !== 'tester') {
    const resetAt = user.usage?.resetAt ? new Date(user.usage.resetAt) : new Date(0)
    if (Date.now() - resetAt.getTime() > RESET_INTERVAL_MS) {
      user.usage.cleanupCount = 0
      user.usage.resetAt = new Date()
      changed = true
    }
  }

  if (changed) await user.save()
  return user
}

// Everything a caller needs to enforce or display quota, computed in one place.
// Call after ensureFreshUsage so both counters are current.
//
// `remaining` is the number that actually bounds the next scan: the smaller of
// what's left this month and what's left today. `limitedBy` says which of the
// two is the binding constraint — it's what lets the UI say "come back at
// midnight" instead of "you've used your monthly plan" when a free user
// finishes today's 100 with most of the month's pool still unused.
export function getQuota(user) {
  const monthlyLimit = getEffectiveLimit(user)
  const monthlyUsed = user.usage?.cleanupCount || 0
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed)

  const dailyLimit = getDailyLimit(user.tier)
  let daily = null
  if (dailyLimit !== null) {
    const dailyUsed = user.usage?.dailyCount || 0
    daily = {
      used: dailyUsed,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - dailyUsed),
      resetsAt: nextIstMidnight(),
    }
  }

  const remaining = daily ? Math.min(monthlyRemaining, daily.remaining) : monthlyRemaining

  let limitedBy = null
  if (remaining <= 0) {
    // Monthly wins when both are exhausted — midnight wouldn't unlock anything.
    limitedBy = monthlyRemaining <= 0 ? 'monthly' : 'daily'
  }

  return {
    used: monthlyUsed,
    limit: monthlyLimit,
    remaining,
    daily,
    limitedBy,
  }
}
