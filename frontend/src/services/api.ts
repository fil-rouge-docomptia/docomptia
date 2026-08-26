import { clearAuthToken, getAuthToken } from '@/lib/auth-session'

export async function authenticatedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  const token = getAuthToken()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(input, {
    ...init,
    headers,
  })

  if (response.status === 401) {
    clearAuthToken()
  }

  return response
}
