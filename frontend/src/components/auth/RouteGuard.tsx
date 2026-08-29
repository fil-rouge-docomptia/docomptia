import { LoaderCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/hooks/use-auth'
import UnauthorizedPage from '@/pages/UnauthorizedPage'

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
    return <UnauthorizedPage />
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
