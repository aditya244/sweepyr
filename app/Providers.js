'use client'

import { useEffect } from 'react'
import { SessionProvider } from 'next-auth/react'

export default function Providers({ children }) {
  useEffect(() => {
    console.log(
      `%cSweepyr%c ${process.env.NEXT_PUBLIC_APP_ENV} · ${process.env.NEXT_PUBLIC_GIT_BRANCH} · ${process.env.NEXT_PUBLIC_APP_VERSION} · v${process.env.NEXT_PUBLIC_APP_VERSION_NUMBER}`,
      'color: #0d9488; font-weight: 700; font-size: 12px;',
      'color: #6b7280; font-size: 11px;'
    )
  }, [])

  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  )
}