import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import connectDB from "../../../../lib/mongoose";
import User from "../../../../models/User";
import Email from "../../../../models/Email";
import { getMessageIds, getEmailMetadata } from "../../../../lib/gmail";
import { classifyEmail } from "../../../../lib/classifier/index";
import { logError, logInfo } from '../../../../lib/logger';
import { getCleanupLimit, ensureFreshUsage } from '../../../../lib/tierLimits';

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
      const cleanupLimit = getCleanupLimit(userTier);
      const alreadyUsed = user.usage.cleanupCount || 0;
      const remaining = Math.max(0, cleanupLimit - alreadyUsed);

      if (remaining <= 0) {
        send({
          error: "USAGE_LIMIT_REACHED",
          message: `You've used all ${cleanupLimit} emails included in your ${userTier} plan this month.`,
          limit: cleanupLimit,
          used: alreadyUsed,
        });
        controller.close();
        return;
      }

      const batchSize = Math.min(requestedSize, remaining);

      // ── Stage 1: Fetch message IDs ──────────────────────────
      send({
        stage: "scanning",
        message: "Fetching email list...",
        progress: 0,
        total: batchSize,
      });

      const { messageIds } = await getMessageIds(user.refreshToken, batchSize);
      const total = messageIds.length;

      send({
        stage: "scanning",
        message: `Found ${total} emails. Fetching metadata...`,
        progress: 0,
        total,
      });

      // ── Stage 2: Fetch metadata in batches of 50 ───────────
      const emails = [];
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

        emails.push(...successful);

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
        message: `Scanned ${emails.length} emails. Starting classification...`,
        progress: total,
        total,
      });

      // Meter usage against the monthly cleanup limit — counts emails
      // actually fetched this request, not just the requested batch size
      user.usage.cleanupCount = alreadyUsed + emails.length;
      await user.save();

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
