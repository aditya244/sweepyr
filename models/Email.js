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
