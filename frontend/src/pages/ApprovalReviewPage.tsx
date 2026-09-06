import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, BadgeCheck } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ApprovalDecisionPanel } from '@/components/approval/ApprovalDecisionPanel'
import { ApprovalReviewContext } from '@/components/approval/ApprovalReviewContext'
import { InvoiceDocumentPanel } from '@/components/invoice/detail/InvoiceDocumentPanel'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/use-auth'
import { ApiError } from '@/services/api'
import {
  approveInvoice,
  getInvoiceDetails,
  listPendingValidationInvoices,
} from '@/services/invoice'
import type {
  InvoiceDetails,
  InvoiceListItem,
  InvoiceSortField,
  SortDirection,
} from '@/types/invoice'

const DEFAULT_QUEUE_SIZE = 8
const queueSortFields: InvoiceSortField[] = ['createdAt', 'invoiceDate', 'totalTtc']

type ApprovalAction = 'approved' | 'approving' | 'idle' | 'loading-next'

type NextInvoice = {
  invoice: InvoiceListItem
  queueIndex: number
  queuePage: number
}

function parsePositiveInteger(value: string | null) {
  const number = Number(value)
  return Number.isInteger(number) && number > 0 ? number : null
}

function parseNonNegativeInteger(value: string | null) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : null
}

function parseSortField(value: string | null): InvoiceSortField {
  return queueSortFields.includes(value as InvoiceSortField)
    ? value as InvoiceSortField
    : 'invoiceDate'
}

function parseDirection(value: string | null): SortDirection {
  return value?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'
}

function getReturnPath(value: string | null) {
  return value && /^\/approvals(?:\?|$)/.test(value) ? value : '/approvals'
}

function getReturnSearchParams(returnTo: string) {
  const queryIndex = returnTo.indexOf('?')
  return new URLSearchParams(queryIndex >= 0 ? returnTo.slice(queryIndex + 1) : '')
}

function getApprovalErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return 'You no longer have permission to approve this invoice.'
    }
    if (error.status === 409) {
      return 'This invoice can no longer be approved. Refresh the review and try again.'
    }
  }

  return 'The backend did not confirm the approval. Please try again.'
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const approvalPendingRef = useRef(false)
  const [retryCount, setRetryCount] = useState(0)
  const [action, setAction] = useState<ApprovalAction>('idle')
  const [actionError, setActionError] = useState<string | null>(null)
  const [queueComplete, setQueueComplete] = useState(false)
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
  const queueSize = parsePositiveInteger(searchParams.get('queueSize')) ?? DEFAULT_QUEUE_SIZE
  const returnSearchParams = getReturnSearchParams(returnTo)
  const returnPage = parsePositiveInteger(returnSearchParams.get('page')) ?? 1
  const queuePage = parseNonNegativeInteger(searchParams.get('queuePage')) ?? returnPage - 1
  const queueIndex = parseNonNegativeInteger(searchParams.get('queueIndex'))
  const sortBy = parseSortField(returnSearchParams.get('sortBy'))
  const direction = parseDirection(returnSearchParams.get('direction'))
  const hasNextInvoice = !position || !total || position < total
  const queueContext = position && total
    ? `Invoice ${position} of ${total}`
    : 'Approval queue invoice'

  const handleStatusChanged = (status: string) => {
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
    approvalPendingRef.current = false
  }, [invoiceId])

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

  const findNextInvoice = useCallback(async (currentInvoiceRemoved: boolean) => {
    const invoicePage = await listPendingValidationInvoices({
      direction,
      page: queuePage,
      size: queueSize,
      sortBy,
    })
    const currentIndex = queueIndex
      ?? invoicePage.content.findIndex((item) => item.invoiceId === invoiceId)
    const candidateIndex = currentInvoiceRemoved
      ? Math.max(currentIndex, 0)
      : currentIndex >= 0 ? currentIndex + 1 : 0
    const candidate = invoicePage.content[candidateIndex]

    if (candidate) {
      return { invoice: candidate, queueIndex: candidateIndex, queuePage } satisfies NextInvoice
    }

    if (!currentInvoiceRemoved && invoicePage.number + 1 < invoicePage.totalPages) {
      const nextPageNumber = invoicePage.number + 1
      const nextPage = await listPendingValidationInvoices({
        direction,
        page: nextPageNumber,
        size: queueSize,
        sortBy,
      })
      const firstInvoice = nextPage.content[0]

      if (firstInvoice) {
        return { invoice: firstInvoice, queueIndex: 0, queuePage: nextPageNumber } satisfies NextInvoice
      }
    }

    return null
  }, [direction, invoiceId, queueIndex, queuePage, queueSize, sortBy])

  const openNextInvoice = useCallback((nextInvoice: NextInvoice) => {
    const nextParams = new URLSearchParams(searchParams)

    if (position) {
      nextParams.set('position', String(position + 1))
    }
    nextParams.set('queueIndex', String(nextInvoice.queueIndex))
    nextParams.set('queuePage', String(nextInvoice.queuePage))
    nextParams.set('queueSize', String(queueSize))

    setAction('idle')
    setActionError(null)
    setQueueComplete(false)
    navigate(`/approvals/${nextInvoice.invoice.invoiceId}?${nextParams.toString()}`)
  }, [navigate, position, queueSize, searchParams])

  const handleApprove = useCallback(async () => {
    if (!invoice || action !== 'idle' || approvalPendingRef.current) {
      return
    }

    approvalPendingRef.current = true
    setActionError(null)
    setAction('approving')

    try {
      await approveInvoice(invoice.invoiceId)
    } catch (error: unknown) {
      approvalPendingRef.current = false
      setAction('idle')
      setActionError(getApprovalErrorMessage(error))
      return
    }

    toast.success('Invoice approved', {
      description: `${invoice.invoiceNumber ?? `Invoice ${invoice.invoiceId}`} was approved. Continue with the next invoice.`,
    })
    setAction('loading-next')

    try {
      const nextInvoice = await findNextInvoice(true)

      if (nextInvoice) {
        openNextInvoice(nextInvoice)
      } else {
        setQueueComplete(true)
        setAction('idle')
      }
    } catch {
      setAction('approved')
      setActionError('The invoice was approved, but the next invoice could not be loaded. Return to the queue to continue.')
    }
  }, [action, findNextInvoice, invoice, openNextInvoice])

  const handleNextInvoice = useCallback(async () => {
    if (action !== 'idle') {
      return
    }

    setActionError(null)
    setAction('loading-next')

    try {
      const nextInvoice = await findNextInvoice(false)

      if (nextInvoice) {
        openNextInvoice(nextInvoice)
      } else {
        setActionError('No other pending invoice is available in this queue.')
        setAction('idle')
      }
    } catch {
      setActionError('The next invoice could not be loaded. Please try again.')
      setAction('idle')
    }
  }, [action, findNextInvoice, openNextInvoice])

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

  if (queueComplete) {
    return (
      <div className="mx-auto flex min-h-[36rem] max-w-2xl items-center justify-center py-8">
        <section className="w-full rounded-lg border border-border bg-card px-8 py-12 text-center shadow-elevation-1">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-muted text-success">
            <BadgeCheck aria-hidden="true" className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.5px] text-foreground">
            Approval queue complete
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            This was the final eligible invoice in your current review sequence.
          </p>
          <Button asChild className="mt-6">
            <Link to={returnTo}>Return to approvals</Link>
          </Button>
        </section>
      </div>
    )
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
          {queueContext} · Review with keyboard shortcuts and auto-advance.
        </p>
      </header>

      <div className="grid min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-elevation-1 xl:h-[49rem] xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)_minmax(17rem,0.55fr)]">
        <InvoiceDocumentPanel invoice={invoice} />
        <div className="min-w-0 border-t border-border xl:h-[49rem] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <ApprovalReviewContext invoice={invoice} />
        </div>
        <div className="min-w-0 border-t border-border xl:h-[49rem] xl:overflow-y-auto xl:border-l xl:border-t-0">
          <ApprovalDecisionPanel
            actionError={actionError}
            approvalConfirmed={action === 'approved'}
            hasNextInvoice={hasNextInvoice}
            invoice={invoice}
            isApproving={action === 'approving'}
            isLoadingNext={action === 'loading-next'}
            onApprove={handleApprove}
            onNextInvoice={handleNextInvoice}
            onStatusChanged={handleStatusChanged}
            role={user?.role.code}
          />
        </div>
      </div>
    </div>
  )
}
