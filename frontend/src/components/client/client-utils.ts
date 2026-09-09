import { ApiError } from '@/services/api'

export type ClientLoadError = 'forbidden' | 'not-found' | 'unavailable' | 'request'

export function getClientLoadError(error: unknown, detail = false): ClientLoadError {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'forbidden'
    if (error.status === 404) return detail ? 'not-found' : 'unavailable'
    if (error.status === 405 || error.status === 501) return 'unavailable'
  }
  return 'request'
}

export function parseClientPage(value: string | null) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 && page <= 2147483647 ? page : 1
}

export function formatClientDate(value: string | null) {
  if (!value) return 'Not provided'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Not provided'
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}
