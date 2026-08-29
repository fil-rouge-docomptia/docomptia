import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

import { AuthContext, type AuthStatus } from '@/contexts/auth-context'
import {
  clearAuthToken,
  getAuthToken,
  setAuthToken,
  subscribeToAuthSession,
} from '@/lib/auth-session'
import { getCurrentUser, login } from '@/services/auth'
import { getOrganizationOnboardingStatus } from '@/services/organization'
import type { CurrentUser, LoginCredentials } from '@/types/auth'

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    getAuthToken() ? 'loading' : 'anonymous',
  )
  const [user, setUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    let isActive = true

    const unsubscribe = subscribeToAuthSession(() => {
      if (!getAuthToken()) {
        setUser(null)
        setStatus('anonymous')
      }
    })

    if (getAuthToken()) {
      getCurrentUser()
        .then((currentUser) => {
          if (isActive) {
            setUser(currentUser)
            setStatus('authenticated')
          }
        })
        .catch(() => {
          if (isActive) {
            setUser(null)
            setStatus(getAuthToken() ? 'error' : 'anonymous')
          }
        })
    }

    return () => {
      isActive = false
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const session = await login(credentials)
    setAuthToken(session.token)
    setStatus('loading')

    try {
      const currentUser = await getCurrentUser()
      let needsCompanyInformation = false

      if (currentUser.role.code === 'ADMIN') {
        try {
          const onboarding = await getOrganizationOnboardingStatus()
          needsCompanyInformation = onboarding.remainingActions.some(
            (action) => action.code === 'ORGANIZATION_INFORMATION',
          )
        } catch {
          needsCompanyInformation = false
        }
      }

      setUser(currentUser)
      setStatus('authenticated')

      return { needsCompanyInformation }
    } catch (error) {
      clearAuthToken()
      setUser(null)
      setStatus('anonymous')
      throw error
    }
  }, [])

  const signOut = useCallback(() => {
    clearAuthToken()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      signIn,
      signOut,
    }),
    [signIn, signOut, status, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
