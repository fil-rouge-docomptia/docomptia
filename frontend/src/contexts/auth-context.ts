import { createContext } from 'react'

import type { CurrentUser, LoginCredentials } from '@/types/auth'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export type AuthContextValue = {
  status: AuthStatus
  user: CurrentUser | null
  signIn: (credentials: LoginCredentials) => Promise<void>
  signOut: () => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
