import { useEffect, useState } from 'react'
import { AlertCircle, ArrowLeft } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'

import { ApprovalDecisionPanel } from '@/components/approval/ApprovalDecisionPanel'
import { ApprovalReviewContext } from '@/components/approval/ApprovalReviewContext'
import { InvoiceDocumentPanel } from '@/components/invoice/detail/InvoiceDocumentPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { getInvoiceDetails } from '@/services/invoice'
import type { InvoiceDetails } from '@/types/invoice'

function parsePositiveInteger(value: string | null) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function getReturnPath(value: string | null) {
  return value && /^\/approvals(?:\?|$)/.test(value) ? value : '/approvals'
}

function ApprovalReviewSkeleton() {
  return (
    <div aria-label="Loading approval review" className="space-y-5">
      <div>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-4 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-full max-w-lg" />
      </div>
      <div className="grid min-h-[42rem] overflow-hidden rounded-lg border border-border bg-card xl:h-[49rem] xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)_minmax(17rem,0.55fr)]">
        <div className="bg-muted/60 p-8">
          <Skeleton className="mx-auto h-[34rem] w-full max-w-[28rem]" />
        </div>
        <div className="space-y-4 border-t border-border p-5 xl:border-l xl:border-t-0">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton className="h-8 w-full" key={index} />
          ))}
        </div>
        <div className="space-y-3 border-t border-border p-5 xl:border-l xl:border-t-0">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  )
}

export default function ApprovalReviewPage() {
  const { invoiceId: invoiceIdParam } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [retryCount, setRetryCount] = useState(0)
  const [requestState, setRequestState] = useState<{
    error: boolean
    invoice: InvoiceDetails | null
    requestKey: string
  }>({ error: false, invoice: null, requestKey: '' })
  const invoiceId = Number(invoiceIdParam)
  const validInvoiceId = Number.isInteger(invoiceId) && invoiceId > 0
  const requestKey = `${invoiceIdParam}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const error = !validInvoiceId || (currentRequest && requestState.error)
  const invoice = currentRequest ? requestState.invoice : null
  const returnTo = getReturnPath(searchParams.get('returnTo'))
  const position = parsePositiveInteger(searchParams.get('position'))
  const total = parsePositiveInteger(searchParams.get('total'))
  const queueContext = position && total
    ? `Invoice ${position} of ${total}`
    : 'Approval queue invoice'

  const handleRejected = (status: string) => {
    setRequestState((currentState) => {
      if (currentState.requestKey !== requestKey || !currentState.invoice) {
        return currentState
      }

      return {
        ...currentState,
        invoice: { ...currentState.invoice, status },
      }
    })
  }

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

  if (error) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-6">
        <Button asChild size="sm" variant="ghost">
          <Link to={returnTo}>
            <ArrowLeft aria-hidden="true" />
            Back to approvals
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load approval review</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>Check that the invoice is still accessible and try again.</p>
            {validInvoiceId ? (
              <Button
                onClick={() => setRetryCount((count) => count + 1)}
                size="sm"
                type="button"
                variant="outline"
              >
                Try again
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!invoice) {
    return <ApprovalReviewSkeleton />
  }

  return (
    <div className="space-y-5">
      <header>
        <Button asChild className="-ml-3" size="sm" variant="ghost">
          <Link to={returnTo}>
            <ArrowLeft aria-hidden="true" />
            Back to approvals
          </Link>
        </Button>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.5px] text-foreground">
          Approval review
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {queueContext} · Review the document, invoice data and accounting context.
        </p>
      </header>

      <div className="grid min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 xl:h-[49rem] xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)_minmax(17rem,0.55fr)]">
        <InvoiceDocumentPanel invoice={invoice} />
        <div className="min-w-0 border-t border-border xl:h-[49rem] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <ApprovalReviewContext invoice={invoice} />
        </div>
        <div className="min-w-0 border-t border-border xl:h-[49rem] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <ApprovalDecisionPanel
            invoice={invoice}
            onRejected={handleRejected}
            role={user?.role.code}
          />
        </div>
      </div>
    </div>
  )
}
