import { LoaderCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { InvoiceDetails, InvoiceDuplicateAlert } from '@/types/invoice'

import { formatInvoiceMoney } from './invoice-detail-utils'

type InvoiceDuplicateWarningProps = {
  alert: InvoiceDuplicateAlert
  canDecide: boolean
  decisionBlocked: boolean
  decisionError: boolean
  decisionPending: boolean
  invoice: InvoiceDetails
  onIgnore: () => Promise<void>
  onReview: () => void
}

export function InvoiceDuplicateWarning({
  alert,
  canDecide,
  decisionBlocked,
  decisionError,
  decisionPending,
  invoice,
  onIgnore,
  onReview,
}: InvoiceDuplicateWarningProps) {
  const matchingInvoice = alert.matchingInvoiceNumber
    ?? (alert.matchingInvoiceId ? `Invoice ${alert.matchingInvoiceId}` : 'another invoice')
  const handleIgnore = async () => {
    try {
      await onIgnore()
    } catch {
      // The parent keeps the alert visible and exposes the request error for retry.
    }
  }

  return (
    <section
      aria-labelledby={`duplicate-alert-${alert.alertId}`}
      className="space-y-3 rounded-lg border border-border bg-card p-4"
    >
      <div className="space-y-1.5 rounded-md bg-warning-muted p-4 text-xs text-warning-muted-foreground">
        <h2 className="font-medium tracking-[0.1px]" id={`duplicate-alert-${alert.alertId}`}>
          Possible duplicate invoice
        </h2>
        <p>
          Matches {matchingInvoice} from {invoice.supplierName ?? 'the same supplier'} ·{' '}
          {formatInvoiceMoney(alert.totalTtc, invoice.currencyCode)}
        </p>
      </div>

      {decisionError ? (
        <Alert variant="destructive">
          <AlertDescription>
            The duplicate decision could not be saved. Review the match and try again.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col justify-end gap-2 sm:flex-row">
        <Button disabled={decisionPending} onClick={onReview} type="button" variant="outline">
          Review match
        </Button>
        {canDecide ? (
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent/80"
            disabled={decisionPending || decisionBlocked}
            onClick={() => void handleIgnore()}
            type="button"
            variant="secondary"
          >
            {decisionPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {decisionPending ? 'Updating…' : 'Not a duplicate'}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
