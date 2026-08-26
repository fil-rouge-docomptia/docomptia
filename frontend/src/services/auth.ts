import { apiBaseUrl } from '@/lib/env'
import type { CurrentUser, LoginCredentials, LoginResponse } from '@/types/auth'
import { authenticatedFetch } from '@/services/api'

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  })

  if (!response.ok) {
    throw new Error('Login failed')
  }

  return (await response.json()) as LoginResponse
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users/me`)

  if (!response.ok) {
    throw new Error('Unable to load current user')
  }

  return (await response.json()) as CurrentUser
}
