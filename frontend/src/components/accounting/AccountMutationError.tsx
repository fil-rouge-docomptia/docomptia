import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ApiError } from '@/services/api'

export function AccountMutationError({ error }: { error: unknown }) {
  if (!error) return null
  const status = error instanceof ApiError ? error.status : null
  const message = status === 403 ? 'Administrator access is required. Close this window and reload after your access has been restored.'
    : status === 404 ? 'This account or action is no longer available in your organization. Close this window and reload the page.'
      : status === 400 ? 'Check the account information and its current status, then try again.'
        : 'The change has not been confirmed. Check your connection and try again.'
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{status === 403 ? 'Account management access denied' : status === 404 ? 'Account unavailable' : 'Unable to save account'}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
