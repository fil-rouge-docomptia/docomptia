import { clearAuthToken, getAuthToken } from '@/lib/auth-session'

export class ApiError extends Error {
  readonly status: number

  constructor(status: number) {
    super('The API request failed')
    this.name = 'ApiError'
    this.status = status
  }
}

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

  if (!response.ok) {
    throw new ApiError(response.status)
  }

  return response
}
