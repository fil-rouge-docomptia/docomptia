import { AlertCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/api'

export function ExportLoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const status = error instanceof ApiError ? error.status : null
  const forbidden = status === 403
  const unavailable = [404, 405, 501].includes(status ?? 0)
  return <Alert variant="destructive">
    <AlertCircle aria-hidden="true" />
    <AlertTitle>{forbidden ? 'Export access denied' : unavailable ? 'Exports unavailable' : 'Unable to load exports'}</AlertTitle>
    <AlertDescription className="space-y-3">
      <p>{forbidden ? 'You do not have access to exports for this organization.' : unavailable ? 'The export service is not available yet.' : 'Check your connection, then try again.'}</p>
      {!forbidden && !unavailable && <Button onClick={onRetry} variant="outline">Try again</Button>}
    </AlertDescription>
  </Alert>
}
