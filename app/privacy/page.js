export default function PrivacyPolicy() {
  const lastUpdated = 'June 2025'

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* Nav */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: "0 40px",
        height: '72px',
        borderBottom: '1px solid #f3f4f6',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
          <img src="/app-icon-512.png" style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '10px',
            objectFit: 'cover',
            flexShrink: 0,
          }} alt="Sweepyr" />
          <span style={{ fontWeight: '700', fontSize: '20px', color: '#111827' }}>Sweepyr</span>
        </a>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="/" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>Home</a>
          <a href="/pricing" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none' }}>Pricing</a>
        </div>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '60px 32px' }}>

        <h1 style={{ fontSize: '36px', fontWeight: '800', color: '#111827', margin: '0 0 8px 0' }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 48px 0' }}>
          Last updated: {lastUpdated}
        </p>

        {[
          {
            title: '1. Introduction',
            content: `Sweepyr ("we", "our", or "us") is a personal project operated by an individual developer based in India. This Privacy Policy explains how we collect, use, and protect your information when you use Sweepyr at sweepyr.com (the "Service").

By using Sweepyr, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use the Service.`,
          },
          {
            title: '2. What We Collect',
            content: `When you sign in with Google, we collect and store:

- Your Google account name, email address, and profile picture
- A Google OAuth refresh token that allows us to access your Gmail on your behalf
- Email metadata: sender address, subject line, date, and email headers (such as List-Unsubscribe and Precedence)
- Classification results: which category each email was sorted into, confidence scores, and actions you take

We do NOT collect or store:
- The body content of any email
- Email attachments or their contents
- Your contacts or calendar data
- Any information beyond what is listed above`,
          },
          {
            title: '3. How We Use Your Information',
            content: `We use the information we collect solely to provide the Sweepyr service:

- Your name and email are used to identify your account
- Your refresh token is used to call the Gmail API on your behalf — to fetch email metadata, apply labels, archive emails, and move emails to Trash
- Email metadata is used to classify emails into categories using our AI pipeline
- Classification results are stored so your dashboard persists between sessions

We do not use your information for advertising, analytics sold to third parties, or any purpose beyond operating the Service.`,
          },
          {
            title: '4. How We Access Your Gmail',
            content: `Sweepyr connects to your Gmail account using Google's official OAuth 2.0 protocol. We request the following Gmail permissions:

- gmail.readonly — to read email metadata (sender, subject, headers)
- gmail.labels — to create and manage labels in your inbox
- gmail.modify — to archive emails and move emails to Trash

Critical privacy guarantee: We call the Gmail API with format=metadata, which is a technical constraint that physically prevents email body content from being included in API responses. This is enforced at the API level — not merely a policy decision. Your email content never reaches our servers.

All actions taken on your Gmail (archiving, labelling, trashing) require your explicit confirmation within the app. Nothing happens to your inbox automatically without your approval.`,
          },
          {
            title: '5. Data Storage',
            content: `Your data is stored in MongoDB Atlas, a cloud database service hosted on servers in the United States. The following data is stored:

- Account information (name, email, Google ID)
- OAuth refresh token (used to call Gmail API on your behalf)
- Email metadata (sender, subject, date, headers — never body content)
- Classification results and action history

Your refresh token is stored to enable background processing. We recommend revoking access via your Google Account settings if you stop using Sweepyr.`,
          },
          {
            title: '6. Data Sharing',
            content: `We do not sell, trade, or share your personal data with third parties except as necessary to operate the Service:

- Google LLC — to authenticate you and access Gmail via their APIs
- MongoDB Atlas — to store your account data and email metadata
- Sentry — to track application errors (error reports may include your email address to help us debug issues)
- Gemini AI (Google) — to classify ambiguous emails. We send only sender address, subject line, and headers — never email body content

No other third parties receive your data.`,
          },
          {
            title: '7. Data Retention',
            content: `We retain your data for as long as you have an active account with Sweepyr. You may request deletion of your account and all associated data at any time by contacting us at the email address below.

Upon deletion:
- Your account record is removed from our database
- All stored email metadata is deleted
- Your refresh token is deleted, revoking our access to your Gmail

You can also revoke Sweepyr's access to your Google account at any time by visiting myaccount.google.com/permissions and removing Sweepyr from the list of connected apps.`,
          },
          {
            title: '8. Your Rights Under Indian Law',
            content: `Under the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023 (DPDPA), you have the right to:

- Access the personal data we hold about you
- Correct inaccurate personal data
- Request deletion of your personal data
- Withdraw consent for processing your data
- Nominate another person to exercise your rights on your behalf

To exercise any of these rights, contact us at the email address provided below. We will respond within 30 days.`,
          },
          {
            title: '9. Security',
            content: `We take reasonable measures to protect your data:

- All data is transmitted over HTTPS
- OAuth refresh tokens are stored in a secured database
- We use Sentry for error monitoring to detect and fix issues quickly
- We do not store passwords — authentication is handled entirely by Google

No method of transmission over the internet is 100% secure. While we strive to protect your data, we cannot guarantee absolute security.`,
          },
          {
            title: '10. Children\'s Privacy',
            content: `Sweepyr is not intended for use by anyone under the age of 13. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it promptly.`,
          },
          {
            title: '11. Changes to This Policy',
            content: `We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date at the top of this page. Your continued use of the Service after changes constitutes acceptance of the updated policy.`,
          },
          {
            title: '12. Contact',
            content: `If you have any questions about this Privacy Policy or want to exercise your data rights, please contact:

Sweepyr
Email: your-email@gmail.com
Location: India

We will respond to all inquiries within 30 days.`,
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: '40px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: '#111827',
              margin: '0 0 12px 0',
            }}>
              {section.title}
            </h2>
            <div style={{
              fontSize: '15px',
              color: '#4b5563',
              lineHeight: '1.8',
              whiteSpace: 'pre-line',
            }}>
              {section.content}
            </div>
          </div>
        ))}

      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #f3f4f6',
        padding: '24px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📬</span>
          <span style={{ fontWeight: '700', color: '#111827' }}>Sweepyr</span>
        </div>
        <div style={{ display: 'flex', gap: '24px' }}>
          <a href="/privacy" style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: '12px', color: '#9ca3af', textDecoration: 'none' }}>Terms of Service</a>
        </div>
      </footer>

    </div>
  )
}