# FEATURES.md — Sweepyr Feature Changelog

> Log of every feature added or meaningfully changed, written from an end
> user's point of view. Add a new entry each time a feature ships — not
> before — following the template below. Don't retrofit old entries; this is
> a record of what shipped when, not a living spec.

---

## Template

### {Feature name}
- **Shipped:** {date}
- **What it is:** 1–2 sentences, product POV — what the user can now do.
- **Why:** the problem it solves or the gap it closes.
- **Impacted pages (test these):** the specific pages/components a human
  should click through to verify the change, from the user's POV.
- **Before:** what the user experienced before this change.
- **After:** what the user experiences now.

---

## Shipped

### Build/deploy versioning
- **Shipped:** 2026-08-10
- **What it is:** Every deployment now exposes what commit, branch, and
  environment (production/preview/development) is actually running —
  in the browser console, the server console/logs, and a public
  `/api/version` endpoint you can `curl` directly.
- **Why:** Directly motivated by the earlier confusion where `main` had
  silently not been updated despite believing it had — a version check
  would have caught that in seconds instead of a multi-step debugging
  detour. Uses Vercel's auto-injected git metadata
  (`VERCEL_GIT_COMMIT_SHA`, `VERCEL_GIT_COMMIT_REF`, `VERCEL_ENV`) rather
  than a manually-bumped version number, since that can't go stale or be
  forgotten — it's tied to the exact commit automatically, every build.
- **Impacted pages (test these):** Open browser devtools console on any
  page — should log a "Sweepyr — {env} · {branch} · {short SHA}" banner
  on load. `curl https://sweepyr.com/api/version` (and the staging
  equivalent) should return matching JSON. Vercel's function logs should
  show the same info once at cold start.
- **Before:** No way to tell what was actually deployed without checking
  Vercel's dashboard directly.
- **After:** A 5-second check from anywhere — browser console, curl, or
  server logs — confirms exactly what's live on any environment.

### Fix: sender-group actions bypassed the confirmation modal entirely
- **Shipped:** 2026-08-10
- **What it is:** Found during staging regression testing — trashing (or
  archiving, or labelling) a sender group from the grouped-by-sender view
  executed immediately with **no confirmation modal at all**, for every
  category including high-risk ones like Finance. The whole-category
  action buttons always correctly opened `ConfirmModal`; the group-level
  buttons never did — they called the Gmail action directly on click.
- **Why:** Directly violates the product's own non-negotiable rule
  ("never act on Gmail without explicit user confirmation," high-risk
  categories require typing DELETE to trash). A user could accidentally
  permanently-trash an entire sender's worth of Finance/Work/Personal
  emails with a single misclick, no undo prompt, no friction at all.
- **Impacted pages (test these):** Category detail, grouped-by-sender
  view — Label (from the `•••` menu), Archive, and Trash buttons on a
  sender group. Test both a high-risk category (Finance, Work, Personal,
  Receipts, Travel, Transactions — should show the red "type DELETE"
  gate) and a low-risk one (Promotions, Newsletter — should show the
  normal confirm/cancel modal).
- **Before:** Clicking a sender-group's Trash/Archive/Label button
  executed immediately, no modal, no way to back out.
- **After:** Same modal used for whole-category actions now opens for
  group actions too, correctly scoped — shows the actual group's email
  count (not the whole category's), names the specific sender in the
  description, and still applies the DELETE-typing gate for high-risk
  categories. The group Trash button also now turns solid red for
  high-risk categories, matching the category-level button's existing
  visual treatment.

### Classifier ruleset expansion — dating, matrimony, brokers, healthcare, gov/tax, and more
- **Shipped:** 2026-08-09
- **What it is:** The rule engine now recognizes ~30 new Indian sender
  verticals it previously didn't — dating apps, matrimony sites, stock
  brokers, government/tax portals, healthcare (pharmacy + diagnostics),
  real estate, wedding vendors, gaming/fantasy sports, parenting e-commerce,
  more ed-tech, coding practice platforms, and religious/spiritual senders.
  It also fixes a real bug found while building this: attachment presence
  (e.g. a bank statement PDF) is now correctly used to distinguish
  important documents from routine marketing — this was designed in the
  original code but was silently non-functional.
- **Why:** Requested as a priority — classification accuracy is the actual
  product. The attachment-escalation bug was found (not requested) while
  designing the same mechanism for the new verticals, and needed fixing
  for the new logic to work at all, so it was fixed in the same pass.
- **Impacted pages (test these):** No direct UI surface — this only
  changes what category an email lands in during a scan. Test via
  `/dashboard` → run a scan with emails from any of the new domains, or
  check `Email.classificationSource` in MongoDB (should be `rules`, not
  `ai`, for the newly-covered domains). Verified with 18 unit-style test
  cases covering every escalation path before shipping (not part of the
  app's test suite — there isn't one yet — run ad hoc).
- **Before:** Emails from these ~30 new verticals fell through to the paid
  AI layer (or were misclassified) since the rule engine didn't recognize
  them. Bank/broker/insurance domains always returned `Finance` regardless
  of whether the email was a real statement or a promotional offer —
  attachment presence was documented as the deciding signal but the code
  path that checked it could never actually be reached.
- **After:** New verticals resolve at the rules layer (free, instant) at
  0.85–0.98 confidence. Attachment-sensitive domains (banks, brokers,
  healthcare diagnostics) now genuinely differ by attachment presence —
  same sender, different category, matching what was always intended.
  Design decisions made along the way: matrimony/dating both map to
  `Social`; healthcare attachments escalate to `Personal` (not `Finance` —
  they're medical records, not money documents); travel attachments don't
  change the category at all, only a new promotional-subject filter
  (`isTravelPromotional`) keeps travel marketing out of the `Travel`
  bucket.
- **Known limitation:** Rules are still built from one inbox's worth of
  intuition, not real user correction data — see `TODO.md`'s "Classification
  accuracy work (3.3)" entry for the plan to close that loop post-launch.

### Search + date filter within category
- **Shipped:** 2026-08-09
- **What it is:** Inside a category's email list, users can now type to
  filter by sender or subject, and/or filter by how old the emails are
  (Last 3 months / 3–12 months / Older than 1 year). Every email row also
  shows a small color badge indicating its age at a glance.
- **Why:** Two real use cases this unblocks: finding one specific email
  (a receipt for a refund, a misclassified email) without scrolling
  through the whole category, and building confidence to bulk-clean old
  emails — a wall of 🔴 badges communicates "these are old and safe to
  clean" faster than reading individual dates. Both were parked ideas
  explicitly prioritized as low-complexity: pure client-side, no new API
  calls, no schema changes (`Email.date` already existed).
- **Impacted pages (test these):** Category detail view (`CategoryDetail.js`)
  — the search box and date filter tabs in the header, in both the flat
  list and the grouped-by-sender view. Also check the "no matches" empty
  state (search for something that doesn't exist) vs. the true "no emails
  in this category" empty state — these are now two distinct messages.
- **Before:** No way to narrow a category's email list except scrolling
  and "Load More." No visual signal of how old an email was beyond reading
  the exact date on each row.
- **After:** A search box + four date-filter tabs (All / Last 3 months /
  3–12 months / Older than 1 year) sit below the category header. Typing
  a sender name or subject keyword narrows the list instantly. Every email
  shows 🟢 (under 1 month), 🟡 (1–12 months), or 🔴 (over a year) next to
  its date. Filtering only applies to already-loaded emails — same
  limitation as pagination itself, not a new one.
- **Known limitation:** Filters only see pages already loaded via "Load
  More," not the full category. Search is Tier A (plain substring match on
  sender + subject combined) — no scope toggle, no autocomplete. Both are
  deliberate scope decisions for this round, discussed and confirmed
  before implementation.

### Tier enforcement + monthly usage tracking
- **Shipped:** 2026-08-09
- **What it is:** The dashboard now reads a user's real subscription tier
  instead of a hardcoded "free" value, and actually tracks how many emails
  they've processed this month against their plan's limit (free: 100,
  pro: 500, annual: 10,000, deep clean: 5,000). When a user runs out of
  quota, scanning stops and they're shown an upgrade prompt instead of
  either silently continuing forever or failing with a generic error.
- **Why:** `CURRENT_TIER` was hardcoded to `'free'` in `CategorySummary.js`,
  and no code anywhere incremented the `usage.cleanupCount` field that
  already existed on the User model — so the advertised "100 emails/month"
  free-tier cap wasn't actually enforced. Needed before real billing can
  mean anything.
- **Impacted pages (test these):** Dashboard home (`/dashboard`) — the
  "Your Mailbox" card's batch-size selector and plan badge, the "Scan &
  Clean" / "Rescan Emails" button, and what happens once the monthly quota
  is exhausted (button should be replaced by an upgrade message linking to
  `/pricing`). Also `/api/user/status` and `/api/gmail/process` responses.
- **Before:** Everyone saw a "Free Plan" badge regardless of actual tier,
  and could click "Scan & Clean" unlimited times with no monthly ceiling —
  the free-tier limit existed only on the pricing page, not in the app.
- **After:** The plan badge reflects the user's real tier. A running
  "X of Y emails used this month" counter is shown next to it. Once quota
  hits zero, the scan button is replaced with *"You've used all N emails
  included in your {tier} plan this month. Upgrade to keep cleaning →"*
  linking to `/pricing`. Usage resets automatically ~30 days after it was
  last reset (lazy check, no cron needed).

### Action button tooltips
- **Shipped:** 2026-08-09
- **What it is:** Hovering any Label / Archive / Trash / Reclassify button
  — at the category level, the sender-group level, or in the live
  monitoring feed — now shows a one-line explanation of exactly what that
  action does in the user's real Gmail account.
- **Why:** Users had to already understand Gmail's own archive/trash/label
  semantics to trust what a click would do to their inbox. This was
  previously agreed and parked as cheap, high-value trust-building work.
- **Impacted pages (test these):** Category detail view (`CategoryDetail.js`
  — both the flat email list and the grouped-by-sender view, including the
  group `•••` overflow menu), and the live Monitoring Feed on the dashboard
  home. Hover every Label/Archive/Trash button and the Reclassify dropdowns
  in each of those places.
- **Before:** No tooltips (or in the monitoring feed's case, a bare
  one-word tooltip like `title="Label"` with no explanation).
- **After:** E.g. hovering Trash shows *"Moves to Gmail Trash. Recoverable
  for 30 days."*; hovering a sender-group's Archive button shows *"Archives
  all 12 emails from noreply@zomato.com. Removes from inbox, keeps in All
  Mail — findable anytime via search."* No behavior change — purely
  additive clarity before the click.
