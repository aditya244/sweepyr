# CLAUDE.md — Sweepyr Project Brief

> Standing context for Claude Code sessions. This file holds things that stay
> true across sessions. For session-to-session working state, see `HANDOFF.md`.

---

## What This Is

Sweepyr is a privacy-first Gmail inbox cleanup tool built for the Indian market.
It connects to a user's Gmail via OAuth, fetches **only email metadata** (sender,
subject line, headers — never body content), classifies emails into 14 categories
using a three-layer pipeline (rule engine → domain reputation → Gemini AI), and
lets users bulk archive, trash, or label emails directly in Gmail. The privacy
guarantee is enforced at the Gmail API level via `format=metadata`, which
physically prevents body content from being returned — it is not a policy promise.

Target user: Indian professionals aged 25–40 with 10,000+ accumulated emails who
have used the same Gmail account for years. The rule engine is tuned specifically
for Indian senders (HDFC, SBI, Paytm, PhonePe, Swiggy, Zomato, Naukri, IRCTC,
CRED, Flipkart, etc.), which is both an accuracy advantage and a competitive moat
against global tools like Clean Email and Unroll.me.

**Note on naming:** The project was originally called "Mailclean" and was renamed
to **Sweepyr** (domain: `sweepyr.com`, not yet purchased). Some older references
to `Mailclean` / `CleanMail` may still exist in the codebase — see HANDOFF.md.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 15** (App Router) | JavaScript, **not** TypeScript |
| UI | React 19 | Function components + hooks only |
| Auth | **NextAuth.js** + Google OAuth 2.0 | Session via JWT strategy |
| Database | **MongoDB Atlas** + Mongoose | Single shared cluster, separate DBs per env |
| Email API | **googleapis** (Node.js client) | Gmail API v1 |
| AI | **@google/generative-ai** — Gemini Flash-Lite | Model string changes frequently, see Gotchas |
| Error tracking | **@sentry/nextjs** | Configured via wizard, `.ts` config files |
| Styling | Tailwind CSS v4 **+ inline styles** | Inline styles dominate — see Conventions |
| Streaming | Server-Sent Events (native `ReadableStream`) | For scan/classify progress |
| Payments | **Razorpay** (planned, not built) | Chosen over Stripe for India |
| Deployment | Undecided — Vercel vs Railway vs Render | See HANDOFF.md open questions |

---

## Project Structure

```
sweepyr/
├── app/
│   ├── layout.js                       Root layout — metadata, favicons, Providers wrapper
│   ├── Providers.js                    Client component wrapping SessionProvider
│   ├── page.js                         Landing / marketing page
│   ├── error.js                        Global error boundary (Sentry capture)
│   ├── globals.css                     Tailwind import + CSS vars
│   │
│   ├── pricing/page.js                 Public pricing page (4 plans + add-ons)
│   ├── privacy/page.js                 Privacy Policy (required for Google OAuth verification)
│   ├── terms/page.js                   Terms of Service (required for Google OAuth verification)
│   │
│   ├── dashboard/
│   │   ├── page.js                     Server component — session guard, header, layout
│   │   ├── not-found.js                Dashboard 404
│   │   ├── DashboardClient.js          Client root — owns ALL shared state, view router
│   │   ├── CategorySummary.js          Mailbox card + batch selector + inbox report
│   │   ├── CategoryDetail.js           Email list, grouping, actions, per-email reclassify
│   │   ├── ConfirmModal.js             Action confirmation, high-risk DELETE gate
│   │   ├── StatsBar.js                 Progress stats + progress bar
│   │   ├── MonitoringFeed.js           Live monitoring feed (UI only — backend not built)
│   │   ├── ScanProgress.js             SSE progress bar component
│   │   ├── OnboardingWelcome.js        First-time user welcome card
│   │   ├── ReconnectBanner.js          Gmail token expiry warning
│   │   └── SignOutButton.js            Client wrapper for signOut()
│   │
│   └── api/
│       ├── auth/[...nextauth]/route.js NextAuth catch-all handler
│       ├── gmail/
│       │   ├── count/route.js          GET  — total mailbox email count
│       │   ├── scan/route.js           POST — legacy scan (superseded by /process)
│       │   ├── classify/route.js       POST — legacy classify (superseded by /process)
│       │   └── process/route.js        GET  — SSE stream: scan + classify combined
│       ├── emails/
│       │   ├── route.js                GET  — paginated emails by category
│       │   ├── [messageId]/route.js    PATCH — reclassify single email
│       │   ├── summary/route.js        GET  — category counts (MongoDB aggregate)
│       │   ├── actions/route.js        POST — bulk action on whole category
│       │   ├── group-action/route.js   POST — action on specific messageIds (sender group)
│       │   ├── feed-action/route.js    POST — single-email action from monitoring feed
│       │   └── monitored/route.js      GET  — monitored emails feed (returns empty for now)
│       ├── stats/route.js              GET  — action totals for StatsBar
│       └── user/status/route.js        GET  — is this a new user? (drives onboarding)
│
├── lib/
│   ├── mongoose.js                     Cached MongoDB connection + error diagnostics
│   ├── authOptions.js                  NextAuth config, Google provider, callbacks
│   ├── gmail.js                        Gmail API client + read operations + auth error detection
│   ├── gmailActions.js                 Gmail write operations (label/archive/trash)
│   ├── logger.js                       Sentry wrapper — logError/logWarning/logInfo
│   ├── apiHelpers.js                   Standard API error responses
│   └── classifier/
│       ├── index.js                    Pipeline orchestrator (3 layers)
│       ├── rules.js                    Layer 1 — domain map + subject regex patterns
│       ├── domain.js                   Layer 2 — sender domain reputation heuristics
│       └── ai.js                       Layer 3 — Gemini classification
│
├── models/
│   ├── User.js                         Google ID, refresh token, tier, usage counters
│   ├── Email.js                        Email metadata + classification result
│   └── ActionHistory.js                Audit trail of every action taken
│
├── public/
│   ├── app-icon.svg                    Primary logo (used in all navs)
│   ├── app-icon-512.png                App icon / OG image
│   ├── app-icon-1024.png               High-res app icon
│   ├── favicon.svg
│   └── favicon-16/32/48/64.png
│
├── instrumentation.ts                  Sentry server init hook
├── instrumentation-client.ts           Sentry browser init (new name for sentry.client.config)
├── sentry.server.config.ts
├── sentry.edge.config.ts
├── next.config.mjs                     Wrapped by Sentry
└── .env.local                          Never committed
```

---

## How To Run It

```bash
# Requires Node.js >= 20.9.0 (Next.js 15 minimum)
nvm use 20

npm install
npm run dev          # http://localhost:3000
npm run build        # production build
npm start            # serve production build
```

There is **no test suite** at present.

### Required Environment Variables

Set in `.env.local` for local dev, and in the hosting provider's dashboard for
deployed environments. **Names only — never commit values.**

```
GOOGLE_CLIENT_ID           OAuth 2.0 client ID from Google Cloud Console
GOOGLE_CLIENT_SECRET       OAuth 2.0 client secret
MONGODB_URI                Full connection string incl. database name
NEXTAUTH_URL               Base URL — http://localhost:3000 locally
NEXTAUTH_SECRET            Generate with: openssl rand -base64 32
GEMINI_API_KEY             From aistudio.google.com
SENTRY_DSN                 Server-side Sentry DSN
NEXT_PUBLIC_SENTRY_DSN     Client-side Sentry DSN (needs NEXT_PUBLIC_ prefix)
```

### External Setup Required

- **Google Cloud Console** — project with Gmail API enabled, OAuth consent
  screen configured, OAuth 2.0 Web client with authorised redirect URI
  `{BASE_URL}/api/auth/callback/google`. Currently in **Testing** mode, so only
  manually-added test users can sign in.
- **MongoDB Atlas** — cluster with Network Access set to `0.0.0.0/0` for dev.
  Production `MONGODB_URI` (set in Vercel) points at a database named
  `sweepyr`. Local dev still points at the original `mailclean` database
  (your own test data — untouched, just no longer what production uses).
  Staging needs a third, separate database, e.g. `sweepyr-staging`.
  MongoDB has no in-place database rename — this was done by pointing the
  connection string's path segment at a new name and letting the app
  auto-provision it on first write, not by migrating the old data.
- **Google AI Studio** — API key with billing enabled (free tier quota is too
  low for real usage; hitting it silently degrades everything to `Uncertain`).

---

## Architecture Overview

### Auth Flow

```
User clicks "Continue with Google"
  → NextAuth redirects to Google consent screen
  → Requests scopes: openid, email, profile,
    gmail.readonly, gmail.labels, gmail.modify
  → access_type=offline + prompt=consent forces a refresh_token
  → Google redirects to /api/auth/callback/google
  → signIn callback fires → upserts User doc in MongoDB, stores refreshToken
  → jwt callback fetches tier from DB → attaches to token
  → session callback exposes session.user.id and session.user.tier
  → Redirect to /dashboard
```

The **refresh token is the critical artifact**. Every Gmail API call constructs a
fresh OAuth2 client from it. Google only issues a refresh token on first consent
or when `prompt=consent` forces re-consent — this is why the signIn callback only
overwrites `refreshToken` when `account.refresh_token` is actually present.

### Data Flow — Scan & Classify

```
CategorySummary.startScanAndClassify()
  → fetch /api/gmail/count            (sets email count)
  → new EventSource('/api/gmail/process?batchSize=N')
        │
        ├─ Server: getMessageIds()     Gmail messages.list, INBOX only
        ├─ Server: loop in chunks of 50
        │    getEmailMetadata()        format=metadata — headers only
        │    upsert into Email collection
        │    send SSE { stage:'scanning', progress, total, percent }
        │
        ├─ Server: query unprocessed Emails from MongoDB
        ├─ Server: loop in batches of 5 (concurrency)
        │    classifyEmail() per email via Promise.allSettled
        │    write category/confidence/classificationSource back
        │    300ms delay between batches (Gemini rate limit)
        │    send SSE { stage:'classifying', progress, total, percent }
        │
        └─ send SSE { stage:'done', summary, layerStats, classified }
  → Client sets classifyResult → inbox report renders
```

### Classification Pipeline

`lib/classifier/index.js` runs three layers in order, short-circuiting on the
first result above `CONFIDENCE_THRESHOLD` (0.85):

1. **`rules.js`** — free, instant. Priority-ordered checks:
   OTP patterns → bank-promotional patterns → transaction patterns →
   `KNOWN_DOMAINS` lookup (200+ entries) → bulk headers (`List-Unsubscribe`,
   `Precedence`) → receipt/travel/job/finance subject patterns.
   Also: finance-domain + attachment → Finance at 0.97 confidence.
   Handles ~99% of emails once the domain map is well populated.

2. **`domain.js`** — free. Subdomain heuristics (`em123.`, `mail.`, `noreply.`),
   personal-provider detection (gmail.com etc. → deliberately returns `null` to
   push these to AI, since only AI can judge a personal email).

3. **`ai.js`** — paid. Gemini Flash-Lite. Sends **only** sender, subject, and two
   header flags. Never body content. Expects strict JSON back. Has retry with
   exponential backoff (5s/10s/15s) on 429 rate limits.

**Order matters.** The bank-promotional check sits *before* the domain lookup
specifically because `sbi.co.in` maps to Finance, but SBI also sends YONO app
adverts that should be Promotions. Subject intent overrides sender identity.

### Gmail Write-Back

All writes go through `lib/gmailActions.js`:
- `getOrCreateLabel()` — checks `labels.list`, creates if absent
- `archiveEmails()` — `batchModify` removing `INBOX`, chunks of 1000
- `trashEmails()` — `messages.trash` individually (no batch endpoint exists),
  chunks of 50 with 500ms pauses
- `applyLabel()` — `batchModify` adding label ID, chunks of 1000

**`messages.delete` is never called.** Trash only. This is a deliberate product
guarantee — a bug in this codebase can never permanently destroy a user's email.

---

## Conventions & Patterns

### Styling — Read This Before Touching UI

**Inline styles are the default. Tailwind is unreliable in this project.**

Over the course of development, Tailwind repeatedly failed to render correctly —
grid columns collapsing to vertical, `fixed` positioning breaking inside
`space-y-*` containers, z-index being overridden by parent stacking contexts,
colour classes not applying. Every one of those was fixed by switching to inline
`style={{}}` objects.

Rules:
- **New UI → inline styles.** Do not introduce new Tailwind classes.
- Existing Tailwind in older components can stay if it works, but if you touch a
  component and something renders wrong, convert it to inline styles rather than
  debugging Tailwind.
- Modals, dropdowns, grids, and anything with `position: fixed` **must** use
  inline styles — these are the specific cases that broke.

### Colour Palette (teal — matches the logo)

```
#0d9488   Primary teal          (buttons, links, accents)
#14b8a6   Light teal            (progress bars, gradients)
#5eead4   Teal border
#0f766e   Dark teal text
#2dd4bf   Teal accent
#f0fdfa   Teal background tint
#99f6e4   Teal border (light)

#111827   Primary text / dark buttons
#6b7280   Secondary text
#9ca3af   Tertiary text
#e5e7eb   Borders
#f9fafb   Card backgrounds

#dc2626   Danger (trash, high-risk)
#d97706   Warning (archive)
#16a34a   Success (complete state — do NOT recolour this to teal)
```

The project was originally indigo (`#4f46e5`) and was globally find-replaced to
teal when the logo was finalised. If you see indigo anywhere, it's a leftover.

### State Management

No Redux, no Zustand, no Context. **State is lifted to `DashboardClient.js`** and
passed down as props. This was a deliberate fix — when state lived inside
`CategorySummary`, it was wiped every time the user navigated into a category
detail view and back.

`DashboardClient.js` owns: `selectedCategory`, `emailCount`, `scanning`,
`scanDone`, `classifying`, `classifyResult`, `progress`, `error`,
`statsRefreshKey`, `showReconnectBanner`, `isNewUser`, `userStatusLoaded`.

Cross-component updates use callback props: `onCategoryOverride`,
`onActionComplete`, `onStatsRefresh`, `onCountRefresh`, `onAuthError`.

`StatsBar` refreshes via a `refreshKey` prop — incrementing it re-triggers its
`useEffect`. This is the pattern for "re-fetch this child's data from a parent."

### API Route Pattern

```js
export async function GET/POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await connectDB()
    const user = await User.findOne({ googleId: session.user.id })
    if (!user?.refreshToken) return Response.json({ error: '...' }, { status: 400 })

    // ... work ...
    return Response.json({ ... })

  } catch (error) {
    logError(error, { route: '/api/...', userId: session?.user?.id, ...context })
    if (error.code === 'GMAIL_AUTH_EXPIRED') {
      return Response.json({ error: 'GMAIL_AUTH_EXPIRED', action: 'RECONNECT' }, { status: 401 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }
}
```

Always: session guard → connectDB → user lookup → work → catch with `logError`
and context object → check `GMAIL_AUTH_EXPIRED` → generic 500.

### Error Handling

- All Gmail calls wrap in `gmailCall(fn)` from `lib/gmail.js`, which detects
  `invalid_grant` / token-expired / 401 and rethrows as
  `error.code === 'GMAIL_AUTH_EXPIRED'`.
- API routes translate that into a `401` with `action: 'RECONNECT'`.
- The frontend catches that error string and sets `showReconnectBanner`, which
  renders `ReconnectBanner` with a "Reconnect Gmail" button that calls `signIn()`.
- Everything goes through `logError(error, context)` — never bare `console.error`
  in production paths. The context object is what makes Sentry useful.

### Naming

- Components: PascalCase, one component per file, colocated in `app/dashboard/`
- Route handlers: always `route.js` inside a folder named for the path segment
- Helpers in `lib/`: camelCase named exports
- Models in `models/`: PascalCase singular, default export
- Mongoose models must use the `mongoose.models.X || mongoose.model('X', schema)`
  guard to survive Next.js hot reload

### Data Model Notes

- `Email` has a compound unique index on `{ userId, messageId }` — prevents
  duplicates and makes per-user queries fast.
- Setting `category: null` on an Email removes it from all category views. This
  is what actions do after acting on emails, alongside `actionTaken: 'archive'`.
- `Email` has `source: 'scanned' | 'monitored'` and `monitoredAt` fields already
  in place, ready for the monitoring backend that hasn't been built yet.

---

## Things That Will Trip You Up

1. **Gemini model strings break constantly.** `gemini-2.0-flash`,
   `gemini-2.0-flash-lite`, `gemini-2.0-flash-001`, and
   `gemini-2.5-flash-lite` have all returned 404 at various points. When
   classification suddenly returns 100% `Uncertain`, check the terminal for a 404
   from `generativelanguage.googleapis.com` before assuming a logic bug. Gemini
   2.0 models were shut down 1 June 2026.

2. **AI failures are silent.** `classifyByAI` catches everything and returns
   `{ category: 'Uncertain', confidence: 0 }`. A dead API key or wrong model name
   looks exactly like poor classification quality from the UI. Always check logs.

3. **`params` is a Promise in Next.js 15.** Dynamic route handlers must
   `const { messageId } = await params` — accessing `params.messageId` directly
   throws.

4. **`layout.js` cannot have `'use client'`** because it exports `metadata`.
   `SessionProvider` lives in `app/Providers.js` for exactly this reason.

5. **Browser caching hides asset changes.** Swapping the logo PNG → SVG appeared
   to do nothing until a hard refresh. If a static asset change seems ignored,
   `rm -rf .next && npm run dev` before debugging.

6. **`resultSizeEstimate` from `messages.list` is unreliable** — it returned 0.
   Use `users.getProfile().messagesTotal` for the mailbox count instead.

7. **Vercel Hobby has a serverless function limit** (~12). This project currently
   has **13 API routes**, which will likely block a Vercel Hobby deploy. A route
   consolidation plan exists in HANDOFF.md.

8. **SSE routes must return `Response` immediately.** The processing runs in a
   detached async IIFE that writes to the stream controller. If you `await` the
   work before returning, the browser never receives the SSE headers.

9. **Tailwind v4 + Apple Silicon** had a native binding failure
   (`@tailwindcss/oxide-darwin-arm64`) after a Node version switch. Fix:
   `rm -rf node_modules .next package-lock.json && npm install`.

---

## Product Rules That Are Not Negotiable

- **Never fetch email body content.** `format: 'metadata'` on every
  `messages.get` call. This is the entire product positioning.
- **Never call `messages.delete`.** Trash only, always recoverable.
- **Never act on Gmail without explicit user confirmation.** Every bulk action
  goes through `ConfirmModal`.
- **High-risk categories** (Finance, Work, Personal, Receipts, Travel,
  Transactions) require typing `DELETE` to trash, and the Cancel button is styled
  as the prominent/safe action with reversed visual hierarchy.
- **"Reclassify" ≠ Gmail action.** Changing an email's category only updates
  MongoDB. It never moves anything in Gmail. The UI language must make this clear.
