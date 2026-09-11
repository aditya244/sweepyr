# HANDOFF.md — Sweepyr Working Context

> Session memory. Everything built, every decision and its reasoning, every
> unresolved item, every dead end. Read alongside `CLAUDE.md`.
>
> **Last updated:** end of the build session that took the project from empty
> repo through Phase 5 + polish pass, rename to Sweepyr, and error handling.

---

## CURRENT STATE

### Phase 1 — Auth & Foundation — ✅ DONE

| Item | Status | Notes |
|---|---|---|
| Next.js 15 App Router scaffold | Done | JavaScript, not TypeScript |
| Google OAuth via NextAuth.js | Done | Scopes: openid, email, profile, gmail.readonly, gmail.labels, gmail.modify |
| Refresh token storage in MongoDB | Done | `access_type: 'offline'` + `prompt: 'consent'` forces issuance |
| MongoDB connection with hot-reload cache | Done | `lib/mongoose.js`, includes error-code diagnostics |
| User model | Done | googleId, email, name, image, refreshToken, tier, usage counters |
| Protected `/dashboard` route | Done | `getServerSession` + `redirect('/')` in server component |
| Sign out | Done | `SignOutButton.js` client wrapper |

### Phase 2 — Gmail Integration — ✅ DONE

| Item | Status | Notes |
|---|---|---|
| Gmail API client from refresh token | Done | `getGmailClient()` in `lib/gmail.js` |
| Mailbox email count | Done | Uses `getProfile().messagesTotal` — see gotcha below |
| Message ID listing | Done | `messages.list` filtered to `INBOX` |
| Metadata fetch (`format=metadata`) | Done | Headers only, body physically excluded |
| Attachment detection | Done | Recursive `detectAttachment()` reading part filenames/mimeTypes only |
| Email model + compound index | Done | `{ userId, messageId }` unique |
| Batch parallel fetching | Done | `Promise.allSettled` so one failure doesn't kill the batch |

### Phase 3 — Classification Pipeline — ✅ DONE

| Item | Status | Notes |
|---|---|---|
| Layer 1 rule engine | Done | 200+ Indian domains, priority-ordered subject regex |
| Layer 2 domain reputation | Done | Subdomain heuristics, personal-provider passthrough |
| Layer 3 Gemini AI | **Flaky** | Works, but model string keeps getting deprecated |
| Pipeline orchestrator | Done | Short-circuits at confidence ≥ 0.85 |
| 14 categories | Done | See list below |
| Confidence scoring | Done | Stored per email |
| Classification source tracking | Done | `rules` / `domain` / `ai` / `user` |
| Rate limit retry with backoff | Done | 3 retries at 5s / 10s / 15s |
| Bank-promotional override | Done | Subject intent beats sender domain (SBI YONO case) |

**Categories:** Spam, Promotions, Newsletter, Social, OTP & Security,
Transactions, Receipts, Finance, Work, Jobs & Careers, Personal, Notifications,
Travel, Uncertain.

**Current split on a real inbox:** ~99 rules / ~1 AI out of 100 emails, once the
Indian domain map was fully populated. Started at 27/73 before that work.

### Phase 4 — Email Review UI — ✅ DONE

| Item | Status | Notes |
|---|---|---|
| Category summary cards | Done | Risk-colour coded, sorted clutter→important |
| Suggested action badges | Done | Fixed 120px width so counts align |
| Category detail email list | Done | Paginated 20/page with Load More |
| "Showing X of Y emails" counter | Done | Updates as pages load |
| Per-email reclassify dropdown | Done | Label needs renaming — see NEXT UP |
| Source badges | Done | Auto-sorted / AI-sorted / You sorted |
| Data persistence on reload | Done | `loadExistingSummary()` on mount |
| Unsubscribe button | Done | Parsed from `List-Unsubscribe`, API URLs filtered out |
| Group by sender domain | Done | Collapsible, sorted by count desc |
| Group-level Archive/Trash | Done | Via `/api/emails/group-action` |
| Group overflow menu (Label + Reclassify) | Done | `•••` menu, z-index fixed |

### Phase 5 — Gmail Write-Back — ✅ DONE

| Item | Status | Notes |
|---|---|---|
| Label creation + apply | Done | `Sweepyr/{Category}` hierarchy |
| Archive (remove INBOX) | Done | `batchModify`, chunks of 1000 |
| Trash (never delete) | Done | `messages.trash` individually, chunks of 50 |
| Confirmation modal | Done | Inline styles only — Tailwind broke it repeatedly |
| High-risk DELETE gate | Done | Typing "DELETE" required for Finance/Work/Personal/Receipts/Travel/Transactions |
| Reversed button hierarchy on high-risk | Done | Cancel is green + prominent, confirm is ghost |
| Action history audit trail | Done | `ActionHistory` collection |
| Post-action state sync | Done | Category count, stats bar, email count all update |

### Polish Pass — ✅ DONE

| Item | Status | Notes |
|---|---|---|
| Hide Rules/Domain/AI stats from users | Done | Internal telemetry only now |
| Source label rename | Done | Was Rule/Domain/AI/You |
| Combined "Scan & Clean" single button | Done | Replaced 3-step flow |
| SSE streaming progress | Done | Replaced separate scan + classify calls |
| Parallel AI (concurrency 5) | Done | ~7–8× faster than sequential |
| Stats bar | Done | Sorted / Trashed / Archived / Labelled |
| Progress bar | Done | Denominator changed — see Key Decisions |
| Batch size selector | Done | Tier-gated, currently hardcoded to free |
| Landing page | Done | Full inline styles, AI + Security sections |
| Pricing page `/pricing` | Done | 4 plans + 2 add-on bundles |
| Privacy Policy `/privacy` | Done | Placeholder contact email — see Known Issues |
| Terms of Service `/terms` | Done | Placeholder contact email — see Known Issues |
| Monitoring feed UI | Done (empty state) | Backend not built |
| Onboarding welcome | Done | Shows only when zero processed emails |
| Error handling + `GMAIL_AUTH_EXPIRED` | Done | Reconnect banner wired up |
| Sentry integration | Done | Wizard-generated `.ts` configs |
| Rename Mailclean → Sweepyr | Mostly done | Some `CleanMail/` refs may remain |
| Logo + favicons applied | Done | SVG in navs, PNG for OG/app icon |
| Indigo → teal global recolour | Done | 6 hex values find-replaced |

### Not Built At All

- **Phase 6 — Live monitoring backend.** Pub/Sub, Gmail `watch`, webhook
  receiver, subscription renewal cron. UI exists and shows empty state.
- **Phase 7 — Razorpay billing.** Pricing page CTAs show a "coming soon" alert.
- **Tier enforcement.** `CURRENT_TIER = 'free'` is hardcoded in
  `CategorySummary.js`. Server-side `TIER_LIMITS` exist and do enforce, reading
  `user.tier` from MongoDB — but nothing ever sets tier to anything but `free`.
- **Deployment.** Nothing is deployed anywhere.
- **Google OAuth verification.** Still in Testing mode, manual test users only.

---

## KEY DECISIONS

### Web app, not browser extension
Extension review cycles are slow, monetisation is harder, and server-side OAuth
is more reliable than extension-based token handling. Extension parked as a
possible later companion for in-Gmail badges.

### `format=metadata` as the privacy mechanism
Chosen over "we promise not to read bodies" because it's enforced by Google's
API, not by our code. Body content cannot be returned regardless of what the
application does. This is the core marketing claim and the main differentiator
vs Clean Email / Unroll.me, and it should never be weakened.

### Three-layer classification instead of AI-only
Cost. AI-only on 5,000 emails would be ~5,000 API calls. With rules handling the
bulk, it's ~1%. Also faster and more deterministic. The layered design means
improving accuracy is usually "add a domain to the map" rather than "tune a
prompt."

### Gemini Flash-Lite over Claude Haiku
Initially recommended Haiku for better structured-output reliability. **Reversed**
once the ₹99/month price ceiling was set. At that price Haiku is ~27% of revenue
in AI cost; Gemini Flash is under 4%. The AI layer is abstracted behind
`classifyByAI()`, so switching back is a one-file change.

### Indian-market pricing from the start
₹99/month cap was a hard constraint from the user, not a guess. This drove the
model choice, the tier limits, and the Razorpay decision. Final structure:

| Plan | Price | Cleanup | Monitoring |
|---|---|---|---|
| Free | ₹0 | 100/mo | 100/mo |
| Pro | ₹99/mo | 500/mo | 500/mo |
| Annual | ₹500/yr | 10,000 credits (pool, not monthly) | 500/mo |
| Deep Clean | ₹299 once | 50,000 once | none |
| Add-on: Starter | ₹29/mo | — | +2,900 |
| Add-on: Power | ₹79/mo | — | +10,000 |

Reasoning on specific numbers:
- **Pro deliberately capped at 500/month**, not 5,000, so heavy-backlog users are
  pushed toward Deep Clean rather than sitting on a monthly plan forever.
- **Annual is a credit pool, not monthly allocation** — feels more generous, and
  lets users burn it at their own pace.
- **Deep Clean is one-time** because one-time purchases convert better than
  subscriptions for a new tool, and it maps to a specific painful problem.
- **Monitoring add-ons as bundles, not per-unit** — ₹29/₹79 is easier to sell
  than "₹1 per 100 emails" even though the underlying rate is the same.
- Break-even is ~18–20 paying users against ~₹1,000–1,700/month fixed infra.

### Razorpay over Stripe
India-first: UPI, netbanking, wallets, RBI compliance. Stripe's India support is
limited. Not yet implemented.

### Trash, never delete
`messages.trash` instead of `messages.delete`. Gmail holds trashed mail for 30
days. This means no bug in this codebase can permanently destroy user email —
worth the small extra API cost (trash has no batch endpoint).

### Show all actions, add friction to risky ones
Originally planned to restrict which actions appear per category (e.g. Finance
gets Label only). **Reversed** — restricting assumes we know better than the user,
and someone may legitimately want to trash three-year-old receipts. Instead:
all actions always available, high-risk categories get a solid-red Trash button,
a warning banner, a "type DELETE" gate, and reversed button hierarchy in the
modal. Friction, not blocking.

### Don't invert risk colours
Considered making "safe to delete" green and "keep" red, on the logic that the
app's purpose is deletion. **Rejected** — red/green conventions are too deeply
ingrained; users would feel anxiety about Finance emails shown in red regardless
of the label text. Colours communicate *"how much attention does this need"*, not
*"should I delete this"*. Added "Suggested: Trash/Archive/Label" badges instead
to guide action without fighting convention.

### Split "Work" into "Work" + "Jobs & Careers"
Naukri/Indeed job alerts were landing in Work alongside real colleague emails.
Job alerts are closer to newsletters than to work. Also moved LinkedIn from
Social to Jobs & Careers for Indian users.

### Subject intent overrides sender domain
Discovered via SBI: `sbi.co.in` maps to Finance, but SBI sends YONO app adverts
and loan offers. Added `isBankPromotional()` which runs *before* the domain
lookup. Generalisable principle — a sender's identity doesn't determine an
email's purpose.

### Attachment presence as a Finance signal
Bank emails with a PDF attached are statements/policy documents (important).
Bank emails without one are usually alerts or marketing. Detected without reading
attachment content — only filenames and mimeTypes from the payload parts.

### SSE over WebSockets
Progress updates are one-directional server→client. SSE works over plain HTTP,
needs no extra infrastructure, and `EventSource` is built into browsers. Replaced
the previous two-call scan-then-classify flow, which gave the user no feedback
during a multi-minute operation.

### Parallel AI with concurrency limit
Sequential with 1s delays would take ~12 minutes for 5,000 emails. Batches of 5
via `Promise.allSettled` with 300ms between batches brings it to ~3–4 minutes.
`allSettled` rather than `all` so one failed call doesn't abort the batch.

### Progress bar denominator = emails scanned, not inbox total
17 cleaned out of 63,295 total renders as 0.0% and an invisible bar. Changed to
measure against emails *scanned* (181), giving 9.4% — accurate, motivating, and
actually visible. Also added a 2% minimum bar width. Total mailbox count still
displays as context on the right.

### Inline styles over Tailwind
Not a preference — a response to repeated failures. See GOTCHAS.

### State lifted to `DashboardClient`
State inside `CategorySummary` was destroyed on every navigation into a category
and back. Lifting to the common parent fixed it. No state library introduced;
props + callbacks are sufficient at this size.

### Skip live monitoring for MVP
Monitoring requires Pub/Sub, webhooks, a public URL, and renewal crons — and adds
ongoing infra cost even for inactive users. The core value ("clean my cluttered
inbox") is fully delivered without it. The empty-state UI was kept because it
signals "more is coming" for free.

### Rename Mailclean → Sweepyr
Better name, domain available. Teal palette derived from the logo. Global
find-replace of six indigo hex values. Gmail label prefix should become
`Sweepyr/` — safe to change now since there are no real users, but would require
migration post-launch.

---

## KNOWN ISSUES / BUGS

1. **"Reclassify" rename not yet applied.** The dropdown still says "Move to..."
   in `CategoryDetail.js` (two places — flat list and expanded group),
   `MonitoringFeed.js` ("Move"), and the group overflow menu ("Move all to").
   Source badge should change from "You moved" → "You sorted". **This is the one
   pending item from the current batch.**

2. **Placeholder contact email in legal pages.** `your-email@gmail.com` appears
   in `app/privacy/page.js` §12 and `app/terms/page.js` §13. Must be replaced
   with a domain email before launch — deliberately not using a personal address.

3. **Vercel function count.** 13 API routes vs Hobby limit of ~12. Deploy will
   likely be blocked. Consolidation plan exists (see NEXT UP) but is untested.

4. **`gemini-2.5-flash-lite` may 404 again.** Model strings have broken four
   times. Symptom is 100% `Uncertain` classification.

5. **`CleanMail/` label prefix may persist** in `lib/gmailActions.js` and
   `app/api/emails/actions/route.js` — needs verifying after the rename.

6. **Dead legacy routes.** `/api/gmail/scan` and `/api/gmail/classify` are
   superseded by `/api/gmail/process` but still exist and count against the
   Vercel function limit. Candidates for deletion.

7. **`onCountRefresh` may be unwired.** It was referenced in `CategoryDetail.js`
   before being passed as a prop, causing a `Can't find variable` error. Fixed by
   either passing it from `DashboardClient` or removing the call — verify which
   route was taken.

8. **Sentry `sendDefaultPii: true`** was the wizard default. Recommended changing
   to `false` given the product's privacy positioning. Verify it was changed.

9. **No tests.** Zero test coverage.

10. **Refresh tokens stored unencrypted** in MongoDB. Acceptable for beta, should
    be encrypted at rest before meaningful user volume.

---

## OPEN QUESTIONS

1. **Where to deploy.** Discussed at length, unresolved:
   - *Vercel* — best Next.js support, edge network, free tier, but function limit
     blocks current structure and Hobby has a 10s timeout that breaks SSE.
   - *Railway* — $5/mo credit, no function limits, persistent server so SSE works,
     but reputation for downtime.
   - *Render* — more stable than Railway, $7/mo for always-on, free tier cold-starts.
   - Also floated: Vercel + Cloudflare in front for Mumbai edge caching.
   - **Plan of record:** try Vercel Hobby unrefactored first to confirm it blocks,
     then branch and refactor routes.

2. **Rename the "Spam" category.** "Spam" collides with Gmail's own folder, so
   users assume reclassifying to Spam does something in Gmail. Candidates
   discussed: **Clutter** (friendly, fits the sweep theme), **Junk Mail** (clearer
   but harsher), Noise, Unwanted, Suspicious, Low Priority. Leaning Clutter or
   Junk Mail. **Not decided.**

3. **Dashboard width.** Set to `max-w-6xl` (1152px). Landing page is full-width.
   Whether that inconsistency matters is unresolved.

4. **Should "Reclassify to Spam" actually mark as spam in Gmail?** Decided *no*
   for now — it would make one category behave differently from thirteen others,
   and training Google's spam filter is a consequential side effect for a
   dropdown. Possible future: an explicit "Report as Spam" action alongside
   Label/Archive/Trash.

5. **Bulk select with checkboxes.** Deemed overkill for v1 given category-level,
   group-level, and per-email actions already exist. Revisit if users ask.

6. **Custom domain timing.** Decided to wait until after soft launch to buy
   `sweepyr.com` — avoids locking in a name before user feedback, and
   `vercel.app` subdomains are accepted by Google OAuth verification.

---

## NEXT UP (priority order)

### 1. Apply the "Reclassify" rename
Small, and it's the one unfinished item from the current batch.
- `CategoryDetail.js` — "Move to..." → "Reclassify" (×2: flat + grouped)
- `CategoryDetail.js` — group menu "Move all to" → "Reclassify all as"
- `MonitoringFeed.js` — "Move" → "Reclassify"
- `SOURCE_LABELS.user.label` — "You moved" → "You sorted"
- Optional hint line under the category header: *"Reclassifying only changes how
  Sweepyr sorts an email — it doesn't move it in Gmail."*

### 2. Action button tooltips (parked, agreed)
Hover tooltips explaining exactly what each action does in Gmail:
- Label → "Adds a `Sweepyr/{Category}` label in Gmail. Emails stay in your inbox."
- Archive → "Removes from inbox, keeps in All Mail. Findable anytime via search."
- Trash → "Moves to Gmail Trash. Recoverable for 30 days."
- Reclassify → "Changes how Sweepyr sorts this email. Nothing changes in Gmail."
- Same tooltips on group-level actions, scoped to the sender group.

### 3. Full regression test pass
A detailed checklist was produced covering auth, onboarding, scan/classify,
dashboard, category detail, grouping, all three actions, high-risk gates, stats,
landing, pricing, legal pages, and MongoDB state. To test onboarding, delete the
user doc + emails + actionhistories collections and clear browser cookies.

### 4. Decide deployment target, then deploy
Staging + production branch strategy was agreed:
- `main` → production, `staging` → staging, `dev/feature-*` → local
- Separate MongoDB database per environment (`sweepyr` vs `sweepyr-staging`),
  same cluster
- Both environment URLs added to Google OAuth redirect URIs
- Protect `main` on GitHub with required PR

### 5. Route consolidation (if Vercel is chosen)
Merge to get under the function limit:
```
/api/gmail/count + scan + classify  → /api/gmail/route.js       (action query param / body field)
/api/emails/actions + group-action + feed-action → /api/emails/manage/route.js
```
Frontend calls change from `fetch('/api/gmail/count')` to
`fetch('/api/gmail?action=count')` etc. Logic unchanged, just fewer files.
Do this on a branch — plan is to confirm the limit blocks first.

### 6. Google OAuth verification submission
Needs: deployed public URL, Privacy Policy URL, Terms URL, scope justification,
and a **demo video** (required for sensitive Gmail scopes). Review takes 3–7 days
so submit early and keep building. Custom domain is *not* required.

### 7. Tier enforcement
Replace `const CURRENT_TIER = 'free'` in `CategorySummary.js` with
`session.user.tier`. The JWT/session callbacks already surface tier, and
server-side `TIER_LIMITS` already enforce it. Blocks billing.

### 8. Razorpay billing (Phase 7)
Checkout, webhooks, subscription management, one-time Deep Clean payment,
add-on purchases, monthly usage counter reset cron, upgrade prompts at limits.

### 9. Phase 6 — Live monitoring backend
Pub/Sub topic + subscription, `gmail.users.watch` registration per user, webhook
receiver, `history.list` fetching by `historyId`, auto-classify with confidence
thresholds (>0.90 auto-apply, 0.70–0.90 flag for review, <0.70 queue), daily cron
to renew watches (they expire every 7 days), tier quota enforcement, weekly
digest email. Data model fields (`source`, `monitoredAt`) already exist.

Agreed feed behaviour: 10 shown initially, Load More up to 50, scrollable
container (~420px) after first load-more, beyond 50 show *"You have N more
monitored emails not shown here. Run a scan to classify and review them."*
Actions are Label/Archive/Trash/Reclassify with **no confirmation modal** —
single-email actions in a live feed don't warrant the friction.

---

## PARKED IDEAS (discussed, not scheduled)

**Dark mode** — significant effort given the inline-style approach; would need a
theme context passing colour objects down the tree. Post-launch.

**Custom user-defined categories** — paid feature. `UserCategory` model with
name/description/keywords/color, checked before the default pipeline, injected
into the AI prompt dynamically. Makes the product stickier.

**Custom labels** — let users name their own Gmail label instead of
`Sweepyr/{Category}`, with previously-used labels saved and offered as a dropdown.

**Search within category** — client-side filter on already-loaded emails by
subject or sender. No API call needed. Use cases: finding a specific receipt,
isolating one sender within Promotions, locating a misclassified email.

**Date filter + email age indicators** — filter by Last 3 months / 3–12 months /
Older than 1 year, plus per-email colour badges (green <1mo, yellow 1–12mo, red
>1yr). The badges matter as much as the filter — they give users the confidence
to bulk-clean without reading each email.

**Undo last action** — toast with a 10-second undo after archive/trash, calling
Gmail to restore. Flagged as the single biggest trust-builder available.

**Smart dashboard suggestions** — surface an actionable insight after
classification, e.g. *"You have 241 unread newsletters from 18 senders. Archive
all?"* Drives action from the summary instead of requiring navigation.

**Sender blocklist** — block a domain from the grouped view; future emails from
it auto-route to Spam/Clutter during monitoring.

**Weekly digest email** — Sunday summary of emails sorted, inbox count, cleaned
count. Re-engagement for inactive users.

**Bulk select with checkboxes** — deferred as overkill for v1.

**Auto-unsubscribe** — one click to unsubscribe from all newsletters using stored
`List-Unsubscribe` headers.

**Duplicate detection** — find near-identical emails (same sender, similar
subject) and group for bulk deletion.

**Browser extension** — in-Gmail classification badges, linking back to the app.

**Team inbox support** — small businesses sharing a Gmail account.

**Mobile app** — React Native against the same API.

**Classification feedback loop** — query `classificationSource: 'user'` grouped by
sender domain to find the most-corrected senders, and feed that straight back
into `KNOWN_DOMAINS`. Also worth adding a `feedback: 'correct' | 'incorrect'`
field to the Email model now (cheap) even if the UI comes later.

**Export report** — CSV of classification results for power users.

**Rescan a specific category** — e.g. only re-run Uncertain, rather than the whole
inbox.

---

## GOTCHAS — Dead Ends and Things That Didn't Work

### Tailwind repeatedly failed to render correctly
The single most time-consuming issue in the project. Failures encountered:
- `grid grid-cols-4` rendered as a vertical stack
- `fixed inset-0` on a modal positioned it at the bottom of the page content
  instead of the viewport
- `z-50` was overridden by parent stacking contexts
- Colour classes silently not applying
- Buttons missing `cursor: pointer`

**Every single one was fixed by converting to inline `style={{}}`.** Debugging
Tailwind in this project is not worth the time — convert and move on. The
`space-y-*` utility in particular appears to create a stacking context that
breaks `position: fixed` in descendants.

### Modal fixes that did NOT work, in order
1. Moving `ConfirmModal` inside/outside various divs — no effect
2. `createPortal(..., document.body)` — made positioning *worse*
3. Adding `mounted` state guard for SSR — no effect
4. **What actually worked:** rendering the modal as a sibling of the content div
   inside a fragment, with 100% inline styles and `zIndex: 99999` set inline
   (not via a Tailwind class).

### Gemini model deprecations — four separate breakages
`gemini-2.0-flash` → 404 → `gemini-2.0-flash-lite` → 404 →
`gemini-2.0-flash-001` → 404 → `gemini-2.5-flash-lite` → worked, then 404 again.
Gemini 2.0 models were shut down 1 June 2026. When classification degrades,
**check the terminal for 404s first.**

### Gemini free tier quota is effectively zero
Errors read `limit: 0` on `generate_content_free_tier_requests`. Billing must be
enabled on the Google Cloud project. Without it every AI call fails and silently
returns `Uncertain`.

### `resultSizeEstimate` returned 0
Switched `getEmailCount` from `getProfile().messagesTotal` to
`messages.list().resultSizeEstimate` to get an inbox-only count. It returned 0.
Reverted to `getProfile().messagesTotal`. Downside: that count includes Trash and
Spam, so it doesn't decrease after archiving.

### Next.js 15 `params` is a Promise
`params.messageId` throws. Must be `const { messageId } = await params`.

### `'use client'` + `export const metadata` are incompatible
`layout.js` can't be a client component. `SessionProvider` moved into
`app/Providers.js`.

### Browser cache masked the logo change
Switched PNG → SVG to remove a white background; the white box persisted through
multiple CSS fixes. The SVG was clean the whole time — it was cached. A hard
refresh resolved it. **Clear cache before debugging static assets.**

### Tailwind v4 native binding failure on Apple Silicon
After switching Node versions: `Cannot find module '@tailwindcss/oxide-darwin-arm64'`.
Fix: `rm -rf node_modules .next package-lock.json && npm install`.

### MongoDB auth failures
`bad auth : authentication failed` (code 8000) — caused by using the Atlas
*account* login instead of a *database user*, and by special characters in the
password not being URL-encoded. Fix: create a dedicated DB user with an
autogenerated alphanumeric password.

### Google OAuth "Access Denied" after adding a test user
Sometimes requires revoking the app at `myaccount.google.com/permissions` and
clearing localhost cookies before it takes effect. Also — the actual `AccessDenied`
error in this project was *not* a Google problem, it was the `signIn` callback
returning `false` because MongoDB auth was failing. **Add logging inside `signIn`
before assuming an OAuth issue.**

### Corrupted refresh tokens from repeated OAuth attempts
Multiple sign-in attempts during setup left a partial refresh token in MongoDB.
Fix: delete the user document and sign in fresh.

### Stale state after actions
The dashboard summary didn't update after archiving/trashing because
`classifyResult.summary` is an in-memory snapshot. Fixed with callback props
(`onActionComplete`, `onStatsRefresh`) plus a `refreshKey` prop on `StatsBar`.
Anything that changes server data must explicitly tell its parent to refresh.

### Emails reappeared in categories after being actioned
Actions weren't clearing the `category` field. Fixed by setting
`category: null, isProcessed: false` alongside `actionTaken` in `updateMany`.

### Unsubscribe links returning raw JSON
Some senders put machine-readable API endpoints in `List-Unsubscribe`. Opening
them shows a JSON blob. Fixed by filtering URLs matching `/api/`, `.json`,
`/v{n}/`, `/oneclick`. Tradeoff: a few legitimate pages get filtered out, but a
missing button beats a broken one.

### Dropdown clipped inside group cards
The `•••` overflow menu was invisible. Cause: `overflow: hidden` on the group
card plus insufficient z-index. Fix: remove `overflow: hidden`, add
`position: relative` with a conditional high `zIndex` on the open group, and set
the menu to `zIndex: 101` with a `zIndex: 100` fixed click-outside catcher.

### Buttons enabled during async operations
The Classify button was clickable mid-scan. Any button triggering async work
needs its condition to include the in-flight state (`&& !scanning`).
