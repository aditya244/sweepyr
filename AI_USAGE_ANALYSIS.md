# Sweepyr — Gemini AI Usage & Cost Analysis

Context dump for a cost/optimization discussion. Covers every place the app talks to
the Gemini API, what drives call volume, what drives per-call cost, and what's
currently *not* instrumented. Codebase is Next.js 15 (JS, not TS), classifier lives
under `lib/classifier/`, the only live entrypoint is the SSE route
`/api/gmail/process`.

---

## 1. The only live call site

`app/api/gmail/process/route.js` (SSE scan+classify route) is the **sole path** that
reaches Gemini. It calls `classifyEmail()` from `lib/classifier/index.js` in
`Promise.allSettled` batches:

- **Concurrency: 5** emails in flight at once (`concurrency = 5`)
- **300ms pause** between batches of 5
- Batch size for the whole scan is `min(requestedSize, remaining-quota)`, and
  `requestedSize` comes from the client (`batchSize` query param), default 100.
- Tier quotas that bound a single run: free=100, pro=500, annual=10000 (credit
  pool), deepclean=5000, tester=1000 (`lib/tierLimits.js`). So a single "Scan &
  Clean" click can trigger **up to thousands of Gemini calls** for higher tiers,
  each one a separate HTTP request to `generativelanguage.googleapis.com`.

There's a second copy of this pipeline, `classifyEmails()` in
`lib/classifier/index.js` (lines 31–52), with its own (differently-implemented,
currently no-op) rate-limit delay — **this function is dead code**. Its only caller
is `app/api/gmail/classify/route.js`, which is entirely commented out (superseded by
`/process`). Worth deleting so nobody "fixes" rate limiting in the wrong place later.

---

## 2. The three-layer pipeline and where cost actually gets decided

`lib/classifier/index.js`:

```
rules.js   (free)  → if confidence >= 0.85, done
domain.js  (free)  → if confidence >= 0.85, done
ai.js      (paid)  → always runs if the above didn't clear 0.85
```

This threshold (`CONFIDENCE_THRESHOLD = 0.85`) is the single biggest lever on
Gemini spend — anything under it falls through to a paid call. **Two branches
currently sit under the threshold and therefore can *never* short-circuit, even
though they represent a real classification guess that's just being discarded:**

- `lib/classifier/domain.js` — suspicious-subdomain match returns confidence
  **0.78** (`Promotions`), and the no-reply-sender match returns **0.80**
  (`Notifications`). Both < 0.85, so `classifyByDomain`'s result is computed,
  then thrown away, and the email always proceeds to Gemini regardless of what
  the domain heuristic concluded.
- `lib/classifier/rules.js` Priority 8, second branch — a bare
  `List-Unsubscribe` header (no `Precedence: bulk`) returns confidence **0.82**
  (`Promotions`). Also always falls through to Gemini. `List-Unsubscribe` is
  extremely common on marketing/bulk mail, so this is likely a large fraction of
  everything that currently reaches the AI layer despite the rule engine already
  having a decent, cheap opinion.

This is the highest-leverage, lowest-risk optimization target: either raise these
three confidences above 0.85 (if you trust them), or explicitly allow "medium
confidence non-AI guess" as an accepted fallback instead of forcing AI on all of
them. Every one of these three converted to a rules/domain resolution is one fewer
Gemini call, permanently, for as long as that sender pattern recurs.

**Personal-provider domains** (`gmail.com`, `yahoo.com`, `outlook.com`,
`hotmail.com`, `icloud.com`, `protonmail.com`, `rediffmail.com`, `ymail.com`) are
*deliberately* routed straight to AI (`classifyByDomain` returns `null` for them
on purpose — comment says "let AI handle personal emails"). For a target user with
10,000+ emails and years of Gmail history, a meaningful share of senders are
plausibly personal-provider domains, so this is a structural (intentional) source
of AI volume, not a bug — but worth knowing when estimating spend, since it can't
be rules-engine'd away without giving up classification quality for that segment.

---

## 3. Per-call cost shape (the prompt itself)

`lib/classifier/ai.js`, `classifyByAI()`:

- **Model**: `genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })`
  — this replaced a commented-out `gemini-2.5-flash-lite` line (left in place,
  not deleted). **No cost/quality comparison between the two was recorded
  anywhere in the code** — worth checking actual per-token pricing for
  `gemini-3.1-flash-lite` in the discussion, since CLAUDE.md separately notes
  Gemini model strings "break constantly" (404s) and that Gemini 2.0 models
  were sunset 2026-06-01. If this model string is even slightly wrong, the
  failure mode is **silent**: every call falls into the `catch` block and
  returns `{ category: 'Uncertain', confidence: 0 }` — indistinguishable from
  genuinely poor classification without checking server logs (this is called
  out as risk #2 in CLAUDE.md already).

- **One email per API call.** No batching of multiple emails into a single
  prompt/response. Given the target user profile (10k+ accumulated emails), this
  means a full backlog cleanup is O(n) separate HTTP round-trips to Gemini, each
  paying the full fixed prompt overhead below on top of the tiny per-email
  signal.

- **Fixed overhead per call is large relative to the actual signal.** The prompt
  sends only `email.from`, `email.subject`, and two boolean-ish header flags
  (`list-unsubscribe` present, `precedence` value) — genuinely small, privacy-
  preserving input. But every single call also re-sends, verbatim:
  - The instruction preamble ("You are an email classifier...")
  - All **14 category names + one-sentence descriptions** (this is the bulk of
    the prompt — roughly 300–400 tokens of static text)
  - The output-format instructions

  None of this varies per email. It's paid for on every single call because
  there's no use of:
  - `systemInstruction` on `getGenerativeModel()` (would separate static
    instructions from the per-call user content — doesn't reduce token count by
    itself, but is a prerequisite for...)
  - Gemini context/prompt caching (`GoogleAICacheManager` / `cachedContent`) —
    **not used anywhere in the codebase.** Whether flash-lite-tier models and a
    ~400-token static prefix are economically worth caching (minimum cacheable
    size, cache storage cost vs. per-call savings) is exactly the kind of
    question worth taking to the pricing discussion — the static prefix here is
    small, so caching might not clear the minimum token threshold or be worth it
    at flash-lite's already-low per-token price. Worth checking Gemini's current
    caching minimums either way.

  A cheaper lever than caching: shortening the 14 category descriptions to
  terse keyword lists instead of full sentences would cut the static portion of
  every single call, compounding across every AI-layer classification forever.

- **Output side**: the requested JSON response includes `category`, `confidence`,
  *and* `reason` (a one-sentence free-text explanation). **`reason` is generated
  by the model, then immediately discarded** — `app/api/gmail/process/route.js`
  destructures only `{ category, confidence, classificationSource }` from the
  result and never persists or displays `reason` anywhere (confirmed: no
  reference to a per-email `reason` field in `app/dashboard/*`, and the `Email`
  model has no `reason` column). This is pure wasted output-token spend on every
  AI-layer call — dropping `reason` from the requested schema is a free win with
  zero product impact today. (If a future "why was this classified this way?"
  UI feature wants it, it's easy to re-add then.)

- **Retry/backoff on rate limits**: up to 3 retries on HTTP 429, waiting
  5s / 10s / 15s sequentially per failing call (`classifyByAI`, recursive retry).
  Because these run inside `Promise.allSettled` batches of 5 concurrent calls,
  a rate-limit event tends to hit **multiple emails in the same batch
  simultaneously**, each independently entering its own backoff-and-retry loop.
  Under load this can turn one rate-limit event into a retry storm — worse
  latency, and if Gemini's per-minute cap is the actual constraint, the retries
  compete with fresh calls for the same quota rather than being staggered/queued
  centrally.

---

## 4. What's tracked today (and the resulting blind spot)

`lib/aiUsageReport.js` + `/admin/ai-usage` page (gated by `ADMIN_EMAILS`):

- Reports **call counts only**, grouped by `classificationSource` (rules/
  domain/ai/user) and, for AI-layer calls specifically, by sender domain
  (extracted from `email.from`), over rolling daily/weekly/monthly/all-time
  windows. Explicitly framed in the UI as "which domains should get a new rule"
  — a rules-engine coverage tool, not a cost tool.
- Filters by `updatedAt` as a proxy for "when was this classified" (there's no
  dedicated classification timestamp) — fine for trend purposes, not billing-
  grade.
- **No token counts are captured anywhere.** The Gemini SDK response
  (`result.response`) includes `usageMetadata` (`promptTokenCount`,
  `candidatesTokenCount`, `totalTokenCount`) — this is never read or logged.
  So today, the only proxy for $ spend is *call count*, not actual tokens
  billed. Two calls can cost very different amounts (subject-line length varies
  a lot) and the current telemetry can't tell them apart. If real cost
  optimization is the goal, capturing and persisting `usageMetadata` per call
  (even just aggregated counters, not per-email) is close to a prerequisite —
  right now there's no way to answer "how many tokens did we actually burn this
  month" without going to the Google AI Studio / Cloud Billing console directly.
- `Email.confidence` and `Email.classificationSource` are stored per email, so
  a one-off backfill script *could* reconstruct historical AI-layer volume, but
  not historical token spend (the raw response was never persisted).

---

## 5. Cross-user redundancy (architectural, bigger lift)

Classification is entirely per-user, per-email — there is no shared/global cache
keyed on, say, `(domain, normalized-subject)`. Given the product's own thesis
(mass-market Indian senders — HDFC, Swiggy, Zomato, Naukri, etc. — recur across
huge numbers of users with near-identical marketing subject lines), it's likely
many users independently pay for an AI classification of what is effectively the
same email. This is a bigger architectural change than the prompt/threshold
tweaks above, but potentially the largest lever if AI-layer volume from
known-but-unmapped domains turns out to be high in the `/admin/ai-usage` report
— which is exactly the report already built to surface that.

---

## 6. Metering vs. actual AI cost — these are different numbers

`user.usage.cleanupCount` (billed against tier quota) counts **all classified
emails**, regardless of which layer classified them — rules-only classifications
consume quota identically to AI-classified ones. This is correct for the
product's usage-limit purpose (metering "emails processed"), but means tier
quota consumption is *not* a proxy for Gemini spend — a user whose inbox is 95%
rules-engine hits and 5% AI hits pays the same quota-usage as a user who's 95%
AI hits, while the latter costs vastly more in actual Gemini billing. Worth
separating "product usage metering" from "AI cost" as two distinct metrics when
discussing pricing — they're conflated today only insofar as both are called
"usage," but the underlying counters (`cleanupCount` vs. `layerStats.ai` /
`aiUsageReport`) are already separate and could be reconciled.

---

## 7. Summary of concrete, low-risk optimization candidates

In rough order of effort vs. payoff:

1. **Drop `reason` from the Gemini JSON schema** — generated and immediately
   discarded on every AI call today. Zero product impact.
2. **Fix the three sub-0.85-confidence branches** (`domain.js` suspicious-
   subdomain 0.78, `domain.js` no-reply 0.80, `rules.js` bare List-Unsubscribe
   0.82) so a real, reasonably-confident non-AI guess isn't silently discarded
   in favor of a paid call every time. Likely the single biggest volume lever,
   since List-Unsubscribe is common on exactly the bulk mail this product exists
   to clean up.
3. **Shrink the static category-description block** in the prompt to keywords
   instead of full sentences — cuts fixed per-call overhead that's paid on every
   single AI-layer classification.
4. **Instrument `usageMetadata`** (token counts) per call, at least as
   aggregated counters — currently there's no way to see actual token spend from
   inside the app at all.
5. **Delete the dead `classifyEmails()` batch function** and its commented-out
   caller — not a cost issue, but a source of confusion if someone "fixes" rate
   limiting there instead of in the live path.
6. **Verify `gemini-3.1-flash-lite` is a real, correctly-priced, non-404ing
   model string** before treating current cost/quality as a baseline — the
   commented-out prior model line suggests this was swapped without a recorded
   comparison.
7. **(Bigger lift) Batch multiple emails per Gemini call**, and/or a
   **cross-user classification cache** keyed on domain + normalized subject —
   both reduce call count rather than per-call cost, and both require the
   `/admin/ai-usage` domain breakdown to size the opportunity first.
