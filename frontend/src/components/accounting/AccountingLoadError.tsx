import { AlertCircle } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/api'

export function AccountingLoadError({ error, detail = false, onRetry }: {
  error: unknown
  detail?: boolean
  onRetry: () => void
}) {
  const status = error instanceof ApiError ? error.status : null
  const forbidden = status === 403
  const missing = detail && status === 404
  const unavailable = !detail && [404, 405, 501].includes(status ?? 0)
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>
        {forbidden ? 'Accounting access denied' : missing ? 'Accounting entry not found'
          : unavailable ? 'Accounting entries unavailable' : 'Unable to load accounting entries'}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{forbidden ? 'You do not have access to these accounting entries.'
          : missing ? 'This entry is not available in your organization.'
            : unavailable ? 'The accounting list is not available yet. You can still consult entries from their invoices.'
              : 'Check your connection, then try again.'}</p>
        {!forbidden && !missing && !unavailable ? <Button onClick={onRetry} size="sm" variant="outline">Try again</Button> : null}
      </AlertDescription>
    </Alert>
  )
}
