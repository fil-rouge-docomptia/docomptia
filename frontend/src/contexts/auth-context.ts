import { createContext } from 'react'

import type { CurrentUser, CurrentUserOrganization, LoginCredentials } from '@/types/auth'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export type SignInResult = {
  needsCompanyInformation: boolean
}

export type AuthContextValue = {
  status: AuthStatus
  user: CurrentUser | null
  signIn: (credentials: LoginCredentials) => Promise<SignInResult>
  signOut: () => void
  updateOrganization: (organization: CurrentUserOrganization) => void
  updateCurrentUser: (profile: Omit<CurrentUser, 'organization'>) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
