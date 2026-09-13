import mongoose from "mongoose";

// This stores the metadata we fetch from Gmail.
// Notice there is no 'body' field — we never store email content.

const EmailSchema = new mongoose.Schema(
  {
    userId: {
      // Links this email to a user in our users collection
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // index for fast lookups by user
    },
    messageId: {
      // Gmail's own ID for this message — we use this to call
      // Gmail API later when applying labels or deleting
      type: String,
      required: true,
    },
    threadId: {
      type: String,
    },
    from: {
      type: String,
    },
    subject: {
      type: String,
    },
    date: {
      type: String,
    },
    labelIds: {
      // Gmail's built-in labels e.g. ['INBOX', 'UNREAD']
      type: [String],
      default: [],
    },
    snippet: {
      // Very short preview text Gmail generates — not the full body
      type: String,
    },
    headers: {
      // Full header map for use in classification later
      type: mongoose.Schema.Types.Mixed,
    },
    // Classification fields — populated in Phase 3
    category: {
      type: String,
      default: null,
    },
    confidence: {
      type: Number,
      default: null,
    },
    classificationSource: {
      // 'rules' | 'domain' | 'ai' — tells us how it was classified
      type: String,
      default: null,
    },
    // ── Immutable classification history ────────────────────────
    // The live `category` / `classificationSource` fields above are
    // mutable working state: actions null out `category`, and a user
    // reclassify overwrites both. That's correct for the dashboard, but
    // it destroys the record of what the classifier originally decided —
    // which is exactly what lib/aiUsageReport.js needs to work out which
    // domains are safe to promote into KNOWN_DOMAINS.
    //
    // These two sub-documents are the durable record. Each is written
    // once and never mutated again, so they survive every later action.
    classifiedAs: {
      // What the classifier decided, written once at classify time by
      // /api/gmail/process. Never overwritten — not even by a reclassify.
      category: { type: String, default: null },
      confidence: { type: Number, default: null },
      source: { type: String, default: null }, // 'rules' | 'domain' | 'ai'
      // Dedicated classification timestamp. `updatedAt` can't serve this
      // purpose — any later archive/trash bumps it, so it reports when
      // the email was last *touched*, not when it was classified.
      at: { type: Date, default: null },
    },
    correctedAs: {
      // Set only when a user reclassifies (PATCH /api/emails/[messageId]).
      // Without this, a reclassify-then-archive sequence leaves only
      // classificationSource: 'user' behind — you'd know a human
      // disagreed but not what they said instead, losing half of the
      // most valuable signal for fixing rules.
      category: { type: String, default: null },
      at: { type: Date, default: null },
    },
    isProcessed: {
      type: Boolean,
      default: false,
    },
    hasAttachment: {
      type: Boolean,
      default: false,
    },
    actionTaken: {
      // 'archive' | 'trash' | 'label' | null
      type: String,
      default: null,
    },
    source: {
      type: String,
      enum: ["scanned", "monitored"],
      default: "scanned",
    },
    monitoredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index — ensures we never store duplicate emails for a user
EmailSchema.index({ userId: 1, messageId: 1 }, { unique: true });

export default mongoose.models.Email || mongoose.model("Email", EmailSchema);
