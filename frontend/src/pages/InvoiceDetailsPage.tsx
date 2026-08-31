import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

import { InvoiceDetailHeader } from '@/components/invoice/detail/InvoiceDetailHeader'
import { InvoiceDocumentPanel } from '@/components/invoice/detail/InvoiceDocumentPanel'
import { InvoiceWorkflowPanel } from '@/components/invoice/detail/InvoiceWorkflowPanel'
import type { InvoiceDetailTab } from '@/components/invoice/detail/InvoiceWorkflowPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getInvoiceDetails, submitInvoiceForValidation } from '@/services/invoice'
import type { InvoiceDetails } from '@/types/invoice'

function InvoiceDetailsSkeleton() {
  return (
    <div aria-label="Loading invoice details" className="space-y-5">
      <div className="border-b border-border pb-5">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-8 w-72 max-w-full" />
        <Skeleton className="mt-2 h-5 w-52" />
      </div>
      <div className="grid min-h-[42rem] overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 xl:h-[49rem] xl:grid-cols-[minmax(0,608fr)_8px_minmax(0,488fr)]">
        <div className="flex flex-col">
          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <Skeleton className="size-8" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-56 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="h-12 border-b border-border" />
          <div className="flex flex-1 justify-center bg-muted/70 p-8">
            <Skeleton className="h-[32rem] w-full max-w-[25rem] rounded-none" />
          </div>
        </div>
        <div className="hidden bg-muted xl:flex xl:justify-center">
          <span className="h-full w-px bg-border" />
        </div>
        <div className="border-t border-border p-4 xl:border-l-0 xl:border-t-0">
          <div className="flex gap-2 border-b border-border pb-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton className="h-9 w-20" key={index} />
            ))}
          </div>
          <div className="mt-5 space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvoiceDetailsPage() {
  const { invoiceId: invoiceIdParam } = useParams()
  const { user } = useAuth()
  const [requestState, setRequestState] = useState<{
    error: boolean
    invoice: InvoiceDetails | null
    requestKey: string
  }>({ error: false, invoice: null, requestKey: '' })
  const [retryCount, setRetryCount] = useState(0)
  const [activeTab, setActiveTab] = useState<InvoiceDetailTab>('details')
  const [correctionState, setCorrectionState] = useState({ dirty: false, saving: false })
  const invoiceId = Number(invoiceIdParam)
  const validInvoiceId = Number.isInteger(invoiceId) && invoiceId > 0
  const requestKey = `${invoiceIdParam}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = !validInvoiceId || (currentRequest && requestState.error)
  const invoice = currentRequest ? requestState.invoice : null

  useEffect(() => {
    if (!validInvoiceId) {
      return
    }

    const controller = new AbortController()

    getInvoiceDetails(invoiceId, controller.signal)
      .then((nextInvoice) => {
        setRequestState({ error: false, invoice: nextInvoice, requestKey })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, invoice: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [invoiceId, requestKey, validInvoiceId])

  const handleRequestApproval = async () => {
    const response = await submitInvoiceForValidation(invoiceId)
    setRequestState((currentState) => ({
      ...currentState,
      invoice: currentState.invoice
        ? { ...currentState.invoice, status: response.status }
        : currentState.invoice,
    }))
  }

  const handleInvoiceUpdated = (updatedInvoice: InvoiceDetails) => {
    setRequestState((currentState) => ({
      ...currentState,
      invoice: updatedInvoice,
    }))
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-6">
        <Button asChild size="sm" variant="ghost">
          <Link to="/invoices">
            <ArrowLeft aria-hidden="true" />
            Back to invoices
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load invoice</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Check that the invoice exists and try again.</p>
            {validInvoiceId ? (
              <Button onClick={() => setRetryCount((count) => count + 1)} size="sm" type="button" variant="outline">
                Try again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!invoice) {
    return <InvoiceDetailsSkeleton />
  }

  return (
    <div className="space-y-5">
      <InvoiceDetailHeader
        correctionState={correctionState}
        invoice={invoice}
        onRequestApproval={handleRequestApproval}
        role={user?.role.code}
        showCorrectionAction={activeTab === 'details'}
      />

      <div className="grid min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 xl:h-[49rem] xl:grid-cols-[minmax(0,608fr)_8px_minmax(0,488fr)]">
        <InvoiceDocumentPanel invoice={invoice} />
        <div className="flex h-2 bg-muted xl:h-auto xl:justify-center">
          <span className="h-px w-full bg-border xl:h-full xl:w-px" />
        </div>
        <InvoiceWorkflowPanel
          activeTab={activeTab}
          invoice={invoice}
          key={invoice.invoiceId}
          onActiveTabChange={setActiveTab}
          onCorrectionStateChange={setCorrectionState}
          onInvoiceUpdated={handleInvoiceUpdated}
          role={user?.role.code}
        />
      </div>
    </div>
  )
}
