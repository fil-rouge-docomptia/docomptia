import { clearAuthToken, getAuthToken } from '@/lib/auth-session'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string

  constructor(status: number, code?: string, message = 'The API request failed') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ApiErrorResponse = {
  code?: string
  message?: string
}

export async function createApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as ApiErrorResponse

    return new ApiError(response.status, payload.code, payload.message)
  } catch {
    return new ApiError(response.status)
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
    throw await createApiError(response)
  }

  return response
}
