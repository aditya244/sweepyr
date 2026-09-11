# TODO.md — Sweepyr Deferred Items

> Tracks work that was deliberately deferred rather than forgotten. Each entry
> has the date it was added, why it's deferred, and what unblocks it.
> When an item is completed, move it to the **Done** section with the
> completion date — don't delete it, so there's a record of when it shipped.

---

## Open

### Replace placeholder contact email in legal pages
- **Added:** 2026-08-09
- **Where:** `app/privacy/page.js:160`, `app/terms/page.js:160`
- **Status:** Not started
- **Why deferred:** Legal pages currently show `your-email@gmail.com`, a
  deliberate placeholder — not using a personal address for the contact
  email, and no domain-backed email exists yet since `sweepyr.com` isn't
  purchased.
- **Unblocks when:** Domain is purchased and a domain email
  (e.g. `support@sweepyr.com`) is set up. Must be done before real launch —
  this is a live contact point for data-deletion/rights requests under the
  Terms and Privacy Policy.

### Classification accuracy work (3.3)
- **Added:** 2026-08-09
- **Status:** Not started
- **Why deferred:** This is genuinely the core product, but it can't be
  done well in isolation — the rule engine is currently built from one
  inbox (the founder's own), and the useful signal only shows up once real
  users generate correction data. Doing this now would mean guessing.
- **What it actually is, in three parts:**
  1. **Pre-launch sanity check** — verify the current Gemini model string
     still resolves (see CLAUDE.md gotcha #1 — these break every few
     months) and that billing is active on the Google AI Studio project.
     Run one real scan and confirm the rules/AI split is still ~99/1 and
     `Uncertain` stays in the low single digits. If not, something's
     broken before any users see it.
  2. **Post-soft-launch signal gathering** — two MongoDB aggregations to
     run periodically once there's real usage:
     - Most-corrected senders (`classificationSource: 'user'`, grouped by
       `from`, sorted by count desc) — direct candidates to add to
       `lib/classifier/rules.js`'s `KNOWN_DOMAINS` map.
     - Domains still falling through to the AI layer
       (`classificationSource: 'ai'`, grouped by `from`, sorted by count
       desc) — candidates for the same treatment, since every one of these
       is a live Gemini API call that could become free/instant.
     Cadence: weekly rule updates based on this data, once there's enough
     volume for it to mean anything.
  3. **Cheap schema prep** — add a `feedback: 'correct' | 'incorrect'`
     field to `models/Email.js` (no UI needed yet). Deliberately bundled
     into this deferred item rather than done in isolation now, even
     though it's a free change — bundling it with the rest keeps all the
     classification-accuracy context in one place instead of scattering it.
- **Unblocks when:** You're ready to start testing classification quality
  — either right before launch (part 1) or once there's enough real-user
  volume for the correction data to be meaningful (parts 2 and 3).

### Undo last action (4.1)
- **Added:** 2026-08-09
- **Status:** Not started
- **Why deferred:** Flagged as the single biggest trust-builder available
  ("a user who knows they can undo will act far more freely"), but it's
  meaningfully more involved than the other Group 4 items, so it's parked
  behind the lower-complexity ones (search, date filter) for this round.
- **What it needs:**
  - New Gmail helpers in `lib/gmailActions.js` — neither `untrash` nor
    "re-add INBOX label" exist yet (only `archiveEmails`, `trashEmails`,
    `applyLabel`, `getOrCreateLabel`).
  - A new API route to reverse an action given an `ActionHistory` record:
    call the right Gmail restore based on `action` type, then revert the
    affected `Email` docs (`category` back to `ActionHistory.category`,
    clear `actionTaken`). `ActionHistory` already stores `messageIds` and
    `category`, so the data needed to do this already exists — just not
    the reversal logic.
  - A toast UI component with a 10-second countdown + undo button, wired
    into all three action-completion sites: category actions and group
    actions in `CategoryDetail.js`, and feed actions in `MonitoringFeed.js`.
- **Unblocks when:** Picked up in a future round — no external blocker,
  just sequenced behind lower-complexity items in this batch.

### Smart dashboard suggestion (4.4)
- **Added:** 2026-08-09
- **Status:** Not started
- **Why deferred:** The most involved of the Group 4 items — needs backend
  work, not just frontend polish.
- **What it needs:**
  - A distinct-sender-count per category, which nothing currently
    computes — `classifyResult.summary` (from `/api/gmail/process`'s SSE
    payload) only has category totals, not sender counts. Needs either a
    new aggregation on `/api/emails/summary` or a new endpoint.
  - A new action-triggering path from the dashboard summary view itself
    (`CategorySummary.js`). Today, bulk actions only exist inside
    `CategoryDetail.js` — the summary view only navigates into a category,
    it doesn't act on one directly. The "Archive them all?" CTA needs that
    wired up as a new capability, reusing `/api/emails/actions` under the
    hood.
- **Unblocks when:** Picked up in a future round, likely after 4.1 given
  relative complexity.

---

## Done

### Replace `mailclean.vercel.app` domain references
- **Added:** 2026-08-09
- **Done:** 2026-08-09
- **What happened:** `sweepyr.com` was purchased. `app/terms/page.js:51` and
  `app/privacy/page.js:49` updated from `mailclean.vercel.app` to `sweepyr.com`.
