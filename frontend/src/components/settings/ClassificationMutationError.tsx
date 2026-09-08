import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ApiError } from '@/services/api'

export function ClassificationMutationError({ error }: { error: unknown }) {
  if (!error) return null
  const status = error instanceof ApiError ? error.status : null
  const message = status === 403 ? 'Administrator access is required. Close this window and reload after your access has been restored.'
    : status === 404 ? 'This category is no longer available in your organization. Close this window and reload the list.'
      : status === 409 ? 'A category of this type already uses this name, including inactive categories. Choose another name.'
        : status === 400 ? 'Check the category information and its current status, then try again.'
          : 'The change has not been confirmed. Check your connection and try again.'
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{status === 403 ? 'Category management access denied' : status === 404 ? 'Category unavailable' : 'Unable to save category'}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
