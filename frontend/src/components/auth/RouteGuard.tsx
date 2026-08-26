import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { ErrorState } from '@/components/states/ErrorState'
import { useAuth } from '@/hooks/use-auth'

function RouteLoadingState() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading session"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" />
    </main>
  )
}

export function ProtectedRoute() {
  const location = useLocation()
  const { status } = useAuth()

  if (status === 'loading') {
    return <RouteLoadingState />
  }

  if (status === 'anonymous') {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  if (status === 'error') {
    return (
      <ErrorState
        actionLabel="Return to sign in"
        actionPath="/login"
        code={401}
        description="We could not verify your session. Sign in again to continue."
        title="Session unavailable"
      />
    )
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <RouteLoadingState />
  }

  if (status === 'authenticated') {
    return <Navigate replace to="/dashboard" />
  }

  return <Outlet />
}
