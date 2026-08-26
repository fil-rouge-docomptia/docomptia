import { apiBaseUrl } from '@/lib/env'
import type { LoginCredentials, LoginResponse } from '@/types/auth'

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
