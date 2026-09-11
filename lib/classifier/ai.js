import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const VALID_CATEGORIES = [
  'Spam',
  'Promotions',
  'Newsletter',
  'Social',
  'OTP & Security',
  'Transactions',
  'Receipts',
  'Finance',
  'Work',
  'Personal',
  'Notifications',
  'Travel',
  'Uncertain',
  'Jobs & Careers'
]

export async function classifyByAI(email, retryCount = 0) {
  //const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' })
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-flash-lite' })
  const prompt = `
You are an email classifier. Classify this email into exactly one category.

Sender: ${email.from}
Subject: ${email.subject || '(no subject)'}
Has unsubscribe option: ${email.headers?.['list-unsubscribe'] ? 'yes' : 'no'}
Precedence header: ${email.headers?.['precedence'] || 'none'}

Categories to choose from:
- Spam: unsolicited, phishing, scam emails
- Promotions: sales, discounts, offers from businesses
- Newsletter: blogs, digests, editorial content
- Social: social media notifications
- OTP & Security: one-time passwords, login alerts, security emails
- Transactions: payment confirmations, bank debits, UPI transactions
- Receipts: order confirmations, invoices, purchase receipts
- Finance: bank statements, tax documents, insurance, investments
- Work: professional emails from colleagues, clients or recruiters
- Personal: emails from friends or family
- Notifications: app alerts, system notifications
- Travel: flight, hotel, train bookings and confirmations
- Uncertain: cannot determine category confidently
- Jobs & Careers: job alerts, recruiter emails, LinkedIn job posts, career opportunities

Respond with ONLY a JSON object, no other text:
{
  "category": "one of the categories above",
  "confidence": 0.0 to 1.0,
  "reason": "one short sentence explaining why"
}
`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim();
    console.log('=== RAW AI RESPONSE ===')
    console.log(text)
    console.log('=== END AI RESPONSE ===')
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!VALID_CATEGORIES.includes(parsed.category)) {
      return {
        category: 'Uncertain',
        confidence: 0.5,
        reason: 'AI returned unrecognised category',
      }
    }

    return {
      category: parsed.category,
      confidence: parsed.confidence,
      reason: parsed.reason,
    }

  } catch (error) {
    // Handle rate limit specifically — wait and retry up to 3 times
    if (error.message?.includes('429') && retryCount < 3) {
      const waitTime = (retryCount + 1) * 5000 // 5s, 10s, 15s
      console.log(`Rate limited — waiting ${waitTime / 1000}s before retry ${retryCount + 1}/3`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return classifyByAI(email, retryCount + 1) // retry
    }

    // For any other error or if retries exhausted, mark as Uncertain
    console.error('AI classification error:', error.message)
    return {
      category: 'Uncertain',
      confidence: 0,
      reason: 'AI classification failed',
    }
  }
}