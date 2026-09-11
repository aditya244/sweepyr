// UNUSED — commented out, not deleted.
// This route is dead code: the frontend function that called it
// (`startClassification()` in app/dashboard/CategorySummary.js) is defined
// but never wired to any button — the dashboard's "Scan & Clean" button
// calls startScanAndClassify() instead, which hits /api/gmail/process (SSE
// route that does scanning + classification together with live progress).
// Superseded by /api/gmail/process. Left in place, commented, for reference.
//
// import { getServerSession } from 'next-auth'
// import { authOptions } from '../../../../lib/authOptions'
// import connectDB from '../../../../lib/mongoose'
// import User from '../../../../models/User'
// import Email from '../../../../models/Email'
// import { classifyEmails } from '../../../../lib/classifier/index'
//
// export async function POST() {
//   const session = await getServerSession(authOptions)
//   if (!session) {
//     return Response.json({ error: 'Unauthorized' }, { status: 401 })
//   }
//
//   try {
//     await connectDB()
//
//     const user = await User.findOne({ googleId: session.user.id })
//     if (!user) {
//       return Response.json({ error: 'User not found' }, { status: 404 })
//     }
//
//     // Fetch all unprocessed emails for this user from MongoDB
//     const emails = await Email.find({
//       userId: user._id,
//       isProcessed: false,
//     }).limit(100);
//
//     if (emails.length === 0) {
//       return Response.json({
//         message: "No emails to classify",
//         classified: 0,
//         summary: {},
//         layerStats: {},
//       });
//     }
//
//     console.log(`Classifying ${emails.length} emails...`)
//
//     // Run through the classification pipeline
//     const results = await classifyEmails(emails)
//
//     const aiClassified = results.filter((r) => r.classificationSource === "ai");
//     if (aiClassified.length > 0) {
//       console.log("=== Domains hitting AI layer ===");
//       aiClassified.forEach((r) => {
//         const email = emails.find(
//           (e) => e._id.toString() === r.emailId.toString(),
//         );
//         if (email) {
//           console.log(
//             `  ${email.from?.match(/@([^>>\s]+)/)?.[1]} → ${r.category} (${r.confidence})`,
//           );
//         }
//       });
//     }
//
//     // Save results back to MongoDB
//     let classified = 0
//     for (const result of results) {
//       await Email.findByIdAndUpdate(result.emailId, {
//         category: result.category,
//         confidence: result.confidence,
//         classificationSource: result.classificationSource,
//         isProcessed: true,
//       })
//       classified++
//     }
//
//     // Build a summary grouped by category for the response
//     const summary = results.reduce((acc, result) => {
//       acc[result.category] = (acc[result.category] || 0) + 1
//       return acc
//     }, {})
//
//     // Count how many went through each layer
//     const layerStats = results.reduce((acc, result) => {
//       acc[result.classificationSource] = (acc[result.classificationSource] || 0) + 1
//       return acc
//     }, {})
//
//     console.log('Classification complete:', summary)
//     console.log('Layer stats:', layerStats)
//
//     return Response.json({
//       success: true,
//       classified,
//       summary,
//       layerStats,
//     })
//
//   } catch (error) {
//     console.error('Classification error:', error);
//     if (error.code === 'GMAIL_AUTH_EXPIRED') {
//       return Response.json(
//         { error: 'GMAIL_AUTH_EXPIRED', action: 'RECONNECT' },
//         { status: 401 }
//       )
//     }
//     return Response.json({ error: error.message }, { status: 500 })
//   }
// }
