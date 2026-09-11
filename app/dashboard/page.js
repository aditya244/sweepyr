import { getServerSession } from 'next-auth'
import { authOptions } from '../../lib/authOptions'
import { redirect } from 'next/navigation'
import SignOutButton from './SignOutButton'
import DashboardClient from './DashboardClient'
import StatsBar from './StatsBar' 
import Link from 'next/link'

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/')
  }

return (
  <div className="min-h-screen bg-gray-50 p-8">
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
  <img
    src="/app-icon.svg"
    style={{
      width: '64px',
      height: '64px',
      flexShrink: 0,
      background: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      boxShadow: 'none',
    }}
    alt="Sweepyr"
  />
  <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: 0 }}>
    Sweepyr
  </h1>
</div>
        <div className="flex items-center gap-4">
          <Link
            href="/pricing"
            style={{
              padding: '8px 16px',
              backgroundColor: '#0d9488',
              color: '#fff',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ⚡ Upgrade
          </Link>
          {session.user.image && (
            <img
              src={session.user.image}
              alt={session.user.name}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <SignOutButton />
        </div>
      </div>
       {/* <StatsBar  refreshKey={statsRefreshKey}/> */}
      <DashboardClient userName={session.user.name}/>
    </div>
  </div>
)
}