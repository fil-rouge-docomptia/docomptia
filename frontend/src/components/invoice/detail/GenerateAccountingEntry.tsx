import { useEffect, useRef, useState } from 'react'
import { FileSpreadsheet, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/services/api'
import { generateInvoiceAccountingEntry, getInvoiceDetails } from '@/services/invoice'
import type { InvoiceDetails } from '@/types/invoice'

export function GenerateAccountingEntry({ invoice, onInvoiceUpdated }: {
  invoice: InvoiceDetails
  onInvoiceUpdated: (invoice: InvoiceDetails) => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  const prerequisite = invoice.status !== 'VALIDEE'
    ? 'Validate this invoice before generating its accounting entry.'
    : invoice.duplicateAlerts.some((alert) => alert.decision === 'PENDING')
      ? 'Resolve the pending duplicate alert before generating the entry.' : null

  async function generate() {
    if (request.current || prerequisite) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setError(null)
    try {
      const response = await generateInvoiceAccountingEntry(invoice.invoiceId, controller.signal)
      if (!controller.signal.aborted) {
        onInvoiceUpdated({ ...invoice, status: response.status, accountingEntry: response.accountingEntry })
      }
    } catch (cause) {
      if (controller.signal.aborted) return
      if (cause instanceof ApiError && cause.code === 'ACCOUNTING_ENTRY_UNBALANCED') {
        try {
          const refreshed = await getInvoiceDetails(invoice.invoiceId, controller.signal)
          if (!controller.signal.aborted) onInvoiceUpdated(refreshed)
        } catch {
          if (!controller.signal.aborted) setError('The proposal was saved but could not be reloaded. Reload the invoice before trying again.')
        }
      } else {
        setError(cause instanceof ApiError && cause.status === 403
          ? 'You do not have permission to generate accounting entries.'
          : cause instanceof ApiError && cause.status === 404
            ? 'This invoice is no longer available. Reload the invoice.'
            : cause instanceof ApiError && cause.status === 409
              ? cause.message : 'Unable to generate the entry. Check your connection and try again.')
      }
    } finally {
      if (!controller.signal.aborted) setPending(false)
      request.current = null
    }
  }

  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <FileSpreadsheet aria-hidden="true" className="size-6" />
      </span>
      <div>
        <h2 className="text-sm font-semibold">No accounting entry yet</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {prerequisite ?? 'Generate an entry using your organization’s accounting rules, then review its lines.'}
        </p>
      </div>
      <Button disabled={pending || Boolean(prerequisite)} onClick={() => void generate()}>
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <FileSpreadsheet aria-hidden="true" />}
        {pending ? 'Generating entry…' : 'Generate accounting entry'}
      </Button>
      {error ? <Alert className="max-w-lg text-left" variant="destructive">
        <AlertTitle>Unable to generate accounting entry</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert> : null}
      <Button asChild variant="link"><Link to="/accounting/rules">Review accounting rules</Link></Button>
    </div>
  )
}
