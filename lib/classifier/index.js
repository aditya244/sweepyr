import { classifyByRules } from './rules'
import { classifyByDomain } from './domain'
import { classifyByAI } from './ai'

// Confidence threshold — if a layer returns confidence above this,
// we trust it and skip subsequent layers
const CONFIDENCE_THRESHOLD = 0.85

export async function classifyEmail(email) {
  // Layer 1: Rules (free, instant)
  const rulesResult = classifyByRules(email)
  if (rulesResult && rulesResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { ...rulesResult, classificationSource: 'rules' }
  }

  // Layer 2: Domain reputation (free, fast)
  const domainResult = classifyByDomain(email)
  if (domainResult && domainResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { ...domainResult, classificationSource: 'domain' }
  }

  // Layer 3: Gemini AI (paid — only reaches here if both above layers
  // returned null or low confidence)
  console.log(`AI classifying: ${email.subject?.substring(0, 50)}`)
  const aiResult = await classifyByAI(email)
  return { ...aiResult, classificationSource: 'ai' }
}

// UNUSED — commented out, not deleted.
// classifyEmails() classified a list of emails one at a time, sequentially,
// with a fixed 100ms pause after each AI-layer call. Its only caller was
// app/api/gmail/classify/route.js, which is itself commented out — the live
// path is /api/gmail/process, which calls classifyEmail() directly in
// concurrent batches of 5 with its own 300ms pacing.
//
// Kept for reference because the planned monitoring backend (HANDOFF §9) will
// need to classify incoming emails in bulk too. Don't revive it as-is: its
// rate limiting is not the one production uses, so tuning here would have no
// effect on real scans. Reuse the batching in process/route.js instead.
//
// export async function classifyEmails(emails) {
//   const results = []
//
//   for (const email of emails) {
//     const result = await classifyEmail(email);
//     results.push({ emailId: email._id, messageId: email.messageId, ...result });
//
//     if (result.classificationSource === "ai") {
//       const delay = process.env.NODE_ENV === "production" ? 100 : 100;
//       await new Promise((resolve) => setTimeout(resolve, delay));
//     }
//   }
//
//   return results
// }