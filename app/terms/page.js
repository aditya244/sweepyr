export default function TermsOfService() {
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
          Terms of Service
        </h1>
        <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 48px 0' }}>
          Last updated: {lastUpdated}
        </p>

        {[
          {
            title: '1. Acceptance of Terms',
            content: `By accessing or using Sweepyr ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.

Sweepyr is a personal project operated by an individual developer based in India. These terms govern your use of the Service available at sweepyr.com.`,
          },
          {
            title: '2. Description of Service',
            content: `Sweepyr is a Gmail inbox management tool that:

- Connects to your Gmail account via Google OAuth
- Fetches email metadata (sender, subject, headers) — never email body content
- Classifies emails into categories using automated rules and AI
- Enables you to archive, trash, or label emails in bulk
- Tracks your inbox cleanup progress

The Service is provided "as is" and may be updated, modified, or discontinued at any time.`,
          },
          {
            title: '3. Google Account Access',
            content: `To use Sweepyr, you must sign in with a Google account and grant us permission to access your Gmail. By doing so, you:

- Authorize Sweepyr to read email metadata from your Gmail inbox
- Authorize Sweepyr to create and apply labels in your Gmail
- Authorize Sweepyr to archive emails and move emails to Trash on your instruction
- Confirm that you own or have authority to manage the Gmail account you connect

You can revoke this access at any time by visiting myaccount.google.com/permissions.`,
          },
          {
            title: '4. User Responsibilities',
            content: `You are responsible for:

- Maintaining the security of your Google account
- All actions taken within Sweepyr using your account
- Reviewing emails before taking bulk actions such as archiving or trashing
- Understanding that moving emails to Trash in Gmail results in permanent deletion after 30 days

You agree not to:

- Use the Service for any unlawful purpose
- Attempt to reverse engineer or compromise the Service
- Use the Service to access Gmail accounts you do not own or have permission to manage
- Misuse the Service in any way that could harm other users or the Service itself`,
          },
          {
            title: '5. Free and Paid Plans',
            content: `Sweepyr offers both free and paid plans:

Free Plan: Limited to 100 emails cleanup and 100 emails monitoring per month at no cost.

Paid Plans: Pro, Annual, and Deep Clean plans are available at the prices listed on our pricing page. Paid features will be activated upon successful payment.

We reserve the right to change pricing at any time. Existing paid subscribers will be notified 30 days in advance of any price changes.

Refunds: Due to the digital nature of the Service, refunds are not provided except where required by applicable law.`,
          },
          {
            title: '6. Data and Privacy',
            content: `Your use of the Service is also governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Service, you agree to the collection and use of your data as described in the Privacy Policy.

We take your privacy seriously. We never read, store, or process the body content of your emails. Our access is limited to email metadata only.`,
          },
          {
            title: '7. Disclaimer of Warranties',
            content: `The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to:

- Uninterrupted or error-free operation
- Accuracy of email classification
- Fitness for a particular purpose
- That emails archived or trashed through the Service will be recoverable

Email classification is automated and may not always be accurate. You are responsible for reviewing classifications before taking bulk actions.`,
          },
          {
            title: '8. Limitation of Liability',
            content: `To the maximum extent permitted by applicable law, Sweepyr and its developer shall not be liable for:

- Any loss of data, including emails that are permanently deleted through use of the Service
- Any indirect, incidental, or consequential damages arising from your use of the Service
- Any errors in email classification that result in unintended actions

Your sole remedy for dissatisfaction with the Service is to stop using it and revoke access to your Google account.`,
          },
          {
            title: '9. Intellectual Property',
            content: `The Sweepyr name, logo, and all content on the Service are owned by the developer and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the Service without explicit written permission.

Your data remains yours. We claim no ownership over your emails, email metadata, or any content from your Gmail account.`,
          },
          {
            title: '10. Termination',
            content: `We reserve the right to suspend or terminate your access to the Service at any time, for any reason, including violation of these Terms.

You may stop using the Service at any time by revoking Sweepyr's access to your Google account at myaccount.google.com/permissions and requesting deletion of your data by contacting us.

Upon termination, all data associated with your account will be deleted within 30 days.`,
          },
          {
            title: '11. Governing Law',
            content: `These Terms are governed by the laws of India. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts located in India.

These Terms are subject to the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023 (DPDPA) of India.`,
          },
          {
            title: '12. Changes to Terms',
            content: `We may update these Terms of Service from time to time. We will notify you of significant changes by updating the "Last updated" date at the top of this page. Your continued use of the Service after changes constitutes acceptance of the updated terms.`,
          },
          {
            title: '13. Contact',
            content: `If you have any questions about these Terms, please contact:

Sweepyr
Email: your-email@gmail.com
Location: India`,
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