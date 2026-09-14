import { apiBaseUrl } from '@/lib/env'
import type {
  CurrentUser,
  LoginCredentials,
  LoginResponse,
  RegistrationDetails,
  RegistrationResponse,
} from '@/types/auth'
import { authenticatedFetch, createApiError } from '@/services/api'

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

export async function register(details: RegistrationDetails): Promise<RegistrationResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(details),
  })

  if (!response.ok) {
    throw await createApiError(response)
  }

  return (await response.json()) as RegistrationResponse
}

export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users/me`, { signal })

  return (await response.json()) as CurrentUser
}
