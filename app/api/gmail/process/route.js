import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import connectDB from "../../../../lib/mongoose";
import User from "../../../../models/User";
import Email from "../../../../models/Email";
import { getMessageIds, getEmailMetadata } from "../../../../lib/gmail";
import { classifyEmail } from "../../../../lib/classifier/index";
import { logError, logInfo, logWarning } from '../../../../lib/logger';
import { getQuota, ensureFreshUsage, MAX_UNACTIONED_BACKLOG } from '../../../../lib/tierLimits';

export async function GET(request) {
  console.log("=== SSE route hit ===");

  const session = await getServerSession(authOptions);
  console.log("=== session:", session?.user?.email);

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedSize = parseInt(searchParams.get("batchSize") || "100");

  // Create a readable stream for SSE
  const encoder = new TextEncoder();
  let controller;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel() {
      console.log("SSE connection closed by client");
    },
  });

  // Helper to send SSE events
  function send(data) {
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    } catch (err) {
      // Client disconnected
    }
  }

  // Run the processing in the background
  (async () => {
    try {
      await connectDB();

      const user = await User.findOne({ googleId: session.user.id });
      if (!user?.refreshToken) {
        send({ error: "No refresh token found" });
        controller.close();
        return;
      }

      await ensureFreshUsage(user);

      const userTier = user.tier || "free";
      const quota = getQuota(user);
      const alreadyUsed = quota.used;
      const alreadyUsedToday = user.usage.dailyCount || 0;

      if (quota.remaining <= 0) {
        let message;
        if (userTier === "tester") {
          message = "You've used all your testing credits.";
        } else if (quota.limitedBy === "daily") {
          message = `You've used today's ${quota.daily.limit} emails. ${quota.daily.limit} more unlock at midnight.`;
        } else {
          message = `You've used all ${quota.limit} emails included in your ${userTier} plan this month.`;
        }
        send({
          error: "USAGE_LIMIT_REACHED",
          message,
          // Lets the client show "come back at midnight" rather than an
          // upgrade prompt when only today's allowance is spent.
          period: quota.limitedBy,
          resetsAt: quota.limitedBy === "daily" ? quota.daily.resetsAt : null,
          limit: quota.limit,
          used: alreadyUsed,
        });
        controller.close();
        return;
      }

      // Guard against endless rescanning without ever reviewing anything —
      // applies to every tier, not just testers. See MAX_UNACTIONED_BACKLOG
      // in lib/tierLimits.js for why this exists alongside net-new metering.
      const backlogCount = await Email.countDocuments({
        userId: user._id,
        isProcessed: true,
        actionTaken: null,
      });

      if (backlogCount >= MAX_UNACTIONED_BACKLOG) {
        send({
          error: "BACKLOG_TOO_LARGE",
          message: `You have ${backlogCount.toLocaleString()} emails waiting for review. Archive, trash, or label some before scanning more.`,
          backlogCount,
        });
        controller.close();
        return;
      }

      // quota.remaining is already the smaller of monthly-left and today-left,
      // so a free user asking for 100 with 40 left today scans 40.
      const batchSize = Math.min(requestedSize, quota.remaining);

      // ── Stage 1: Fetch message IDs — new-to-us only ─────────
      // Previously fetched whatever sat in the Gmail inbox regardless of
      // whether we'd already scanned it before, re-downloading metadata for
      // the same familiar messages on every scan (they stay in the inbox
      // until archived/trashed — scanning alone never removes them). Now
      // pages through the inbox, checking each page against what we already
      // have on file, and only keeps message IDs we've genuinely never seen.
      // "batchSize" now means "up to N messages new to us," not "the top N
      // in the inbox regardless of familiarity."
      send({
        stage: "scanning",
        message: "Fetching email list...",
        progress: 0,
        total: batchSize,
      });

      const MAX_EXAMINED = 5000; // safety cap so a huge, mostly-known inbox
      // can't make one scan page through it indefinitely
      let messageIds = [];
      let pageToken = null;
      let examinedCount = 0;

      do {
        const page = await getMessageIds(user.refreshToken, 500, pageToken);
        if (page.messageIds.length === 0) break;

        examinedCount += page.messageIds.length;

        const knownDocs = await Email.find({
          userId: user._id,
          messageId: { $in: page.messageIds.map((m) => m.id) },
        }).select("messageId").lean();
        const knownIds = new Set(knownDocs.map((e) => e.messageId));

        messageIds.push(...page.messageIds.filter((m) => !knownIds.has(m.id)));
        pageToken = page.nextPageToken;
      } while (
        messageIds.length < batchSize &&
        pageToken &&
        examinedCount < MAX_EXAMINED
      );

      messageIds = messageIds.slice(0, batchSize);
      const total = messageIds.length;

      send({
        stage: "scanning",
        message:
          total === 0
            ? "No new emails found — everything in your inbox has already been scanned."
            : `Found ${total} new email${total === 1 ? "" : "s"}. Fetching metadata...`,
        progress: 0,
        total,
      });

      // ── Stage 2: Fetch metadata in batches of 50 ───────────
      const emails = [];
      let failedCount = 0;
      const metadataBatchSize = 50;

      for (let i = 0; i < messageIds.length; i += metadataBatchSize) {
        const chunk = messageIds.slice(i, i + metadataBatchSize);

        // Fetch chunk in parallel
        const results = await Promise.allSettled(
          chunk.map(({ id }) => getEmailMetadata(user.refreshToken, id)),
        );

        const successful = results
          .filter((r) => r.status === "fulfilled")
          .map((r) => r.value);
        const failed = results.filter((r) => r.status === "rejected");

        emails.push(...successful);
        failedCount += failed.length;

        // Previously silent — a chunk could fail entirely (e.g. Gmail API
        // rate limiting on rapid back-to-back scans) with zero visibility,
        // making "why did this scan process fewer emails than expected"
        // undiagnosable. Now logged with a sample error to actually see why.
        if (failed.length > 0) {
          logWarning("Some emails failed to fetch during scan", {
            route: "/api/gmail/process",
            userId: session?.user?.id,
            chunkSize: chunk.length,
            failedInChunk: failed.length,
            sampleError: failed[0].reason?.message || String(failed[0].reason),
          });
        }

        // Save to MongoDB
        for (const email of successful) {
          try {
            await Email.findOneAndUpdate(
              { userId: user._id, messageId: email.messageId },
              { ...email, userId: user._id },
              { upsert: true, new: true },
            );
          } catch (err) {
            // ignore duplicate errors
          }
        }

        const scanned = Math.min(i + metadataBatchSize, total);
        send({
          stage: "scanning",
          message: `Scanning emails...`,
          progress: scanned,
          total,
          percent: Math.round((scanned / total) * 100), // scanning = 0-50%
        });
      }

      send({
        stage: "scanning",
        message:
          failedCount > 0
            ? `Scanned ${emails.length} emails (${failedCount} failed to fetch — see below). Starting classification...`
            : `Scanned ${emails.length} emails. Starting classification...`,
        progress: total,
        total,
        failedCount,
      });

      // ── Stage 3: Classify emails ────────────────────────────
      // Fetch unprocessed emails from DB
      const unprocessed = await Email.find({
        userId: user._id,
        isProcessed: false,
      }).limit(batchSize);

      const classifyTotal = unprocessed.length;
      let classified = 0;
      const summary = {};
      const layerStats = { rules: 0, domain: 0, ai: 0 };

      // Process in parallel batches of 5
      const concurrency = 5;
      for (let i = 0; i < unprocessed.length; i += concurrency) {
        const batch = unprocessed.slice(i, i + concurrency);

        // Fire batch in parallel
        const results = await Promise.allSettled(
          batch.map((email) => classifyEmail(email)),
        );

        // Save results
        for (let j = 0; j < batch.length; j++) {
          const result = results[j];
          const email = batch[j];

          if (result.status === "fulfilled") {
            const { category, confidence, classificationSource } = result.value;

            await Email.findByIdAndUpdate(email._id, {
              category,
              confidence,
              classificationSource,
              // Durable copy of the same verdict. The three fields above
              // are working state the dashboard mutates (actions null out
              // `category`, a reclassify rewrites `classificationSource`);
              // this one is never written again, so the AI usage report
              // can still tell what the classifier originally decided
              // after the user has acted on their inbox. Safe to write
              // unconditionally here — the query above only selects
              // isProcessed: false, so an email reaches this line once.
              classifiedAs: {
                category,
                confidence,
                source: classificationSource,
                at: new Date(),
              },
              isProcessed: true,
            });

            summary[category] = (summary[category] || 0) + 1;
            if (layerStats[classificationSource] !== undefined) {
              layerStats[classificationSource]++;
            }
          }
          classified++;
        }

        // Small delay between batches to respect rate limits
        if (i + concurrency < unprocessed.length) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const classifyPercent = Math.round((classified / classifyTotal) * 100)
          send({
            stage: 'classifying',
            message: 'Classifying emails...',
            progress: classified,
            total: classifyTotal,
            percent: classifyPercent, // now matches the X/Y numbers shown
          })
      }

      // Meter usage against the monthly cleanup limit — counts emails
      // actually newly classified this request (net-new), not raw emails
      // fetched. Rescanning an inbox you'd already scanned before used to
      // charge the full fetch count even when most of it was duplicates
      // you already had — meaning the quota-consumed number and the
      // "emails processed" number shown on the dashboard could disagree.
      // Metering by `classified` makes them the same number everywhere.
      user.usage.cleanupCount = alreadyUsed + classified;
      // Same net-new count against today's allowance. A scan that crosses
      // midnight lands on the day it started; the next ensureFreshUsage
      // call resets the counter for the new day.
      user.usage.dailyCount = alreadyUsedToday + classified;
      await user.save();

      // ── Done ────────────────────────────────────────────────
      send({
        stage: "done",
        message: "Complete!",
        percent: 100,
        summary,
        layerStats,
        classified,
      });
    } catch (error) {
      logError(error, {
        route: "/api/gmail/process",
        userId: session?.user?.id,
        batchSize,
      });
      if (error.code === "GMAIL_AUTH_EXPIRED") {
        send({ error: "GMAIL_AUTH_EXPIRED", action: "RECONNECT" });
      } else {
        send({ error: error.message });
      }
    } finally {
      controller.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
