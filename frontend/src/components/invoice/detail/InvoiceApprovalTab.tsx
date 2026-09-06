import { useEffect, useState } from 'react'
import {
  AlertCircle,
  CircleCheck,
  CircleDashed,
  LockKeyhole,
  Pencil,
} from 'lucide-react'

import { InvoiceCorrectionRequestDialog } from '@/components/approval/InvoiceCorrectionRequestDialog'
import { InvoiceRejectionDialog } from '@/components/approval/InvoiceRejectionDialog'
import { InvoiceApprovalTimeline } from '@/components/invoice/detail/InvoiceApprovalTimeline'
import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { hasPermission } from '@/lib/permissions'
import {
  approveInvoice,
  getInvoiceHistory,
  rejectInvoice,
  requestInvoiceCorrection,
} from '@/services/invoice'
import type { InvoiceDetails, InvoiceHistoryItem } from '@/types/invoice'

import {
  formatApprovalDate,
  getInvoiceApprovalHistoryContext,
} from './invoice-approval-utils'
import { canCorrectInvoice, canValidateInvoice } from './invoice-detail-utils'

type InvoiceApprovalTabProps = {
  invoice: InvoiceDetails
  onEditInvoice: () => void
  onStatusChanged: (status: string) => void
  permissions?: readonly string[]
}

function approvalMessage(invoice: InvoiceDetails, permissions?: readonly string[]) {
  const canApprove = hasPermission(permissions, 'invoice.approve')

  if (invoice.status === 'A_VERIFIER') {
    return canApprove
      ? 'This invoice is ready for your accounting decision.'
      : 'This invoice is waiting for a user with approval permission.'
  }

  if (invoice.status === 'EXTRAITE') {
    return canApprove
      ? 'The accounting team must complete its review before this invoice reaches you.'
      : 'Review the extracted fields, then request approval from the invoice header.'
  }

  if (['VALIDEE', 'COMPTABILISEE', 'EXPORTABLE', 'EXPORTEE', 'ARCHIVEE'].includes(invoice.status)) {
    return 'The approval step has been completed for this invoice.'
  }

  return 'Approval becomes available after invoice extraction and review are complete.'
}

function getInitials(author?: string | null) {
  if (!author) {
    return '—'
  }

  return author
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function ApprovalStateSkeleton() {
  return (
    <div aria-label="Loading approval history" className="space-y-5 p-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-[4.5rem] w-full" key={index} />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  )
}

function SubmissionSummary({
  history,
  rejected,
}: {
  history: InvoiceHistoryItem[]
  rejected: boolean
}) {
  const context = getInvoiceApprovalHistoryContext(history)
  const decision = rejected ? context.rejected : context.requested
  const personLabel = rejected ? 'Rejected by' : 'Submitted by'
  const dateLabel = rejected ? 'Rejected' : 'Requested'

  return (
    <aside
      aria-label="Approval summary"
      className="self-start rounded-lg border border-border bg-card p-4"
    >
      <InvoiceStatusBadge status={rejected ? 'REJETEE' : 'A_VERIFIER'} />
      <Separator className="my-5" />

      {rejected ? (
        <div className="mb-5">
          <p className="text-xs text-muted-foreground">Rejection reason</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-5 text-foreground">
            {context.rejected?.comment ?? 'No rejection reason is available.'}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
            {getInitials(decision?.author)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{personLabel}</p>
          <p className="truncate text-sm font-medium text-foreground">
            {decision?.author ?? 'Not available'}
          </p>
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs text-muted-foreground">{dateLabel}</p>
        <p className="mt-1 text-sm font-medium text-foreground">
          {formatApprovalDate(decision?.date, false)}
        </p>
      </div>
    </aside>
  )
}

function BasicApprovalState({
  invoice,
  permissions,
}: {
  invoice: InvoiceDetails
  permissions?: readonly string[]
}) {
  const completed = ['VALIDEE', 'COMPTABILISEE', 'EXPORTABLE', 'EXPORTEE', 'ARCHIVEE'].includes(
    invoice.status,
  )

  return (
    <div className="p-6">
      <section className="rounded-lg border border-border bg-background p-5 shadow-elevation-1">
        <div className="flex items-start gap-4">
          <span
            className={
              completed
                ? 'flex size-10 shrink-0 items-center justify-center rounded-full bg-success-muted text-success'
                : 'flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground'
            }
          >
            {completed ? (
              <CircleCheck aria-hidden="true" className="size-5" />
            ) : invoice.status === 'A_VERIFIER' ? (
              <CircleDashed aria-hidden="true" className="size-5" />
            ) : (
              <LockKeyhole aria-hidden="true" className="size-5" />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current approval status
            </p>
            <div className="mt-2">
              <InvoiceStatusBadge status={invoice.status} />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {approvalMessage(invoice, permissions)}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

export function InvoiceApprovalTab({
  invoice,
  onEditInvoice,
  onStatusChanged,
  permissions,
}: InvoiceApprovalTabProps) {
  const [requestState, setRequestState] = useState<{
    error: boolean
    history: InvoiceHistoryItem[] | null
    requestKey: string
  }>({ error: false, history: null, requestKey: '' })
  const [retryCount, setRetryCount] = useState(0)
  const [approvePending, setApprovePending] = useState(false)
  const [approveError, setApproveError] = useState(false)
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const trackedState = invoice.status === 'A_VERIFIER' || invoice.status === 'REJETEE'
  const requestKey = `${invoice.invoiceId}:${invoice.status}:${retryCount}`
  const currentRequest = requestState.requestKey === requestKey
  const history = currentRequest ? requestState.history : null
  const historyError = currentRequest && requestState.error
  const canValidate = invoice.status === 'A_VERIFIER' && canValidateInvoice(permissions)
  const canEdit = invoice.status === 'REJETEE' && canCorrectInvoice(invoice.status, permissions)

  useEffect(() => {
    if (!trackedState) {
      return
    }

    const controller = new AbortController()

    getInvoiceHistory(invoice.invoiceId, controller.signal)
      .then((nextHistory) => {
        setRequestState({ error: false, history: nextHistory, requestKey })
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setRequestState({ error: true, history: null, requestKey })
        }
      })

    return () => controller.abort()
  }, [invoice.invoiceId, requestKey, trackedState])

  if (!trackedState) {
    return <BasicApprovalState invoice={invoice} permissions={permissions} />
  }

  const handleApprove = async () => {
    setApproveError(false)
    setApprovePending(true)

    try {
      const response = await approveInvoice(invoice.invoiceId)
      onStatusChanged(response.status)
    } catch {
      setApproveError(true)
    } finally {
      setApprovePending(false)
    }
  }

  const handleReject = async (reason: string) => {
    const response = await rejectInvoice(invoice.invoiceId, { reason })
    onStatusChanged(response.status)
  }

  const handleRequestCorrection = async (reason: string) => {
    const response = await requestInvoiceCorrection(invoice.invoiceId, { reason })
    onStatusChanged(response.status)
  }

  if (!history && !historyError) {
    return <ApprovalStateSkeleton />
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.25px] text-foreground">Approval</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {invoice.status === 'REJETEE' ? 'Invoice rejected' : 'Waiting for approval'}
          </p>
        </div>

        {canValidate ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() => setCorrectionDialogOpen(true)}
              type="button"
              variant="outline"
            >
              Request changes
            </Button>
            <Button
              onClick={() => setRejectionDialogOpen(true)}
              type="button"
              variant="outline"
            >
              Reject
            </Button>
            <Button disabled={approvePending} onClick={handleApprove} type="button">
              {approvePending ? 'Approving…' : 'Approve'}
            </Button>
          </div>
        ) : canEdit ? (
          <Button onClick={onEditInvoice} type="button" variant="secondary">
            <Pencil aria-hidden="true" />
            Edit invoice
          </Button>
        ) : null}
      </header>

      {historyError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to load approval history</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>The invoice remains available. Try loading its approval context again.</p>
            <Button
              onClick={() => setRetryCount((count) => count + 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {approveError ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Unable to approve invoice</AlertTitle>
          <AlertDescription>
            The backend did not confirm the approval. Review the status and try again.
          </AlertDescription>
        </Alert>
      ) : null}

      {history ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <InvoiceApprovalTimeline
            context={getInvoiceApprovalHistoryContext(history)}
            state={invoice.status === 'REJETEE' ? 'rejected' : 'waiting'}
          />
          <SubmissionSummary history={history} rejected={invoice.status === 'REJETEE'} />
        </div>
      ) : null}

      <InvoiceCorrectionRequestDialog
        onOpenChange={setCorrectionDialogOpen}
        onRequestCorrection={handleRequestCorrection}
        open={correctionDialogOpen}
      />
      <InvoiceRejectionDialog
        onOpenChange={setRejectionDialogOpen}
        onReject={handleReject}
        open={rejectionDialogOpen}
      />
    </div>
  )
}
