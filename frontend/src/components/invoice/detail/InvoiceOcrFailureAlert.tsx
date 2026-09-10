import { AlertCircle, Pencil } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { InvoiceOcrError } from '@/types/invoice'

import { isRetryableOcrError } from './invoice-detail-utils'

type InvoiceOcrFailureAlertProps = {
  canCorrect: boolean
  error: InvoiceOcrError | null
  onStartManualCorrection: () => void
}

export function InvoiceOcrFailureAlert({
  canCorrect,
  error,
  onStartManualCorrection,
}: InvoiceOcrFailureAlertProps) {
  const retryable = isRetryableOcrError(error)
  const isPostOcrFailure = error?.step && error.step !== 'OCR_ANALYSIS'

  return (
    <Alert
      className="border-transparent bg-destructive text-destructive-foreground [&>svg]:text-destructive-foreground"
      variant="destructive"
    >
      <AlertCircle aria-hidden="true" />
      <AlertTitle>{isPostOcrFailure ? 'Invoice processing failed' : 'OCR processing failed'}</AlertTitle>
      <AlertDescription className="space-y-3 text-destructive-foreground/90">
        <p>{error?.message ?? 'The document could not be processed.'}</p>
        <p>
          {retryable
            ? 'Retry OCR or review the original file before correcting the invoice.'
            : 'This error cannot be fixed by retrying OCR. Complete the invoice fields manually.'}
        </p>
        {error?.code ? (
          <p className="font-mono text-[11px] text-destructive-foreground/75">
            Error code: {error.code}
          </p>
        ) : null}
        {error?.step ? (
          <p className="font-mono text-[11px] text-destructive-foreground/75">
            Step: {error.step}
          </p>
        ) : null}
        {!retryable && canCorrect ? (
          <Button
            className="bg-background text-foreground hover:bg-background/90"
            onClick={onStartManualCorrection}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Pencil aria-hidden="true" />
            Enter details manually
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
