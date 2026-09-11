import './globals.css'
import Providers from './Providers'

export const metadata = {
  // Derived from NEXTAUTH_URL (already set per-environment) rather than a
  // literal domain, so OG/social image resolution is correct on staging and
  // localhost too, not just production.
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'https://sweepyr.com'),
  title: 'Sweepyr — Clean your inbox',
  description: 'Privacy-first Gmail inbox cleanup. Sort, archive and delete email clutter without us ever reading your emails.',
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/favicon-64.png', sizes: '64x64', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/app-icon-512.png', sizes: '512x512' },
  },
  openGraph: {
    title: 'Sweepyr — Clean your inbox',
    description: 'Privacy-first Gmail inbox cleanup tool built for Indian users.',
    images: [{ url: '/app-icon-1024.png' }],
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}