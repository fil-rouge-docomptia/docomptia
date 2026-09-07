import { AlertCircle } from 'lucide-react'

import type { ClientLoadError as ClientLoadErrorType } from '@/components/client/client-utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

const messages = {
  forbidden: ['Client access denied', 'You do not have permission to view clients in this organization.'],
  'not-found': ['Client not found', 'This client is not available in your current organization.'],
  unavailable: ['Clients module unavailable', 'Client consultation is disabled because the required service is not available in this environment.'],
  request: ['Unable to load clients', 'Check your connection, then try again.'],
} as const

export function ClientLoadError({ error, onRetry }: {
  error: ClientLoadErrorType
  onRetry: () => void
}) {
  const [title, description] = messages[error]
  return (
    <Alert variant="destructive">
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{description}</p>
        {error === 'request' || error === 'unavailable' ? (
          <Button onClick={onRetry} size="sm" type="button" variant="outline">Try again</Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
