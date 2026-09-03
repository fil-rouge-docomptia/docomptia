import { useEffect, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  MessageSquareText,
  X,
} from 'lucide-react'

import { InvoiceCorrectionRequestDialog } from '@/components/approval/InvoiceCorrectionRequestDialog'
import { InvoiceRejectionDialog } from '@/components/approval/InvoiceRejectionDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getInvoiceHistory, rejectInvoice, requestInvoiceCorrection } from '@/services/invoice'
import type { RoleCode } from '@/types/auth'
import type { InvoiceDetails } from '@/types/invoice'

function getBlockingReasons(invoice: InvoiceDetails, role?: RoleCode) {
  const reasons: string[] = []

  if (role !== 'RESPONSABLE_COMPTABLE') {
    reasons.push('An accounting manager role is required.')
  }
  if (invoice.status !== 'A_VERIFIER') {
    reasons.push('The invoice is not waiting for approval.')
  }
  if (invoice.ocrError) {
    reasons.push('The OCR error must be resolved.')
  }
  if (!invoice.supplier) {
    reasons.push('The supplier is missing.')
  }
  if (!invoice.invoiceNumber) {
    reasons.push('The invoice number is missing.')
  }
  if (!invoice.invoiceDate) {
    reasons.push('The invoice date is missing.')
  }
  if (!invoice.totalHt || !invoice.totalTva || !invoice.totalTtc) {
    reasons.push('The invoice amounts are incomplete.')
  }
  if (invoice.duplicateAlerts.some((alert) => alert.decision === 'PENDING')) {
    reasons.push('The suspected duplicate must be resolved.')
  }

  return reasons
}

function KeyboardKey({ children }: { children: string }) {
  return (
    <kbd
      aria-hidden="true"
      className="ml-auto flex size-5 items-center justify-center rounded border border-current/20 bg-background/80 text-[10px] font-semibold"
    >
      {children}
    </kbd>
  )
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && (
    target.isContentEditable
    || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
  )
}

type ApprovalDecisionPanelProps = {
  actionError: string | null
  approvalConfirmed: boolean
  hasNextInvoice: boolean
  invoice: InvoiceDetails
  isApproving: boolean
  isLoadingNext: boolean
  onApprove: () => void
  onNextInvoice: () => void
  onStatusChanged: (status: string) => void
  role?: RoleCode
}

export function ApprovalDecisionPanel({
  actionError,
  approvalConfirmed,
  hasNextInvoice,
  invoice,
  isApproving,
  isLoadingNext,
  onApprove,
  onNextInvoice,
  onStatusChanged,
  role,
}: ApprovalDecisionPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false)
  const [correctionReason, setCorrectionReason] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyRetryCount, setHistoryRetryCount] = useState(0)
  const blockingReasons = getBlockingReasons(invoice, role)
  const ready = blockingReasons.length === 0
  const busy = approvalConfirmed || isApproving || isLoadingNext
  const decisionHelpId = `approval-decision-help-${invoice.invoiceId}`
  const correctionRequested = invoice.status === 'EXTRAITE' && correctionReason !== null
  const rejected = invoice.status === 'REJETEE'

  useEffect(() => {
    if (!rejected || rejectionReason) {
      return
    }

    const controller = new AbortController()

    getInvoiceHistory(invoice.invoiceId, controller.signal)
      .then((history) => {
        const latestRejection = history.findLast((item) => (
          item.type === 'VALIDATION_DECISION' && item.action === 'REJECTION'
        ))
        setRejectionReason(latestRejection?.comment ?? null)
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setHistoryError(true)
        }
      })

    return () => controller.abort()
  }, [historyRetryCount, invoice.invoiceId, rejected, rejectionReason])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.altKey
        || event.ctrlKey
        || event.metaKey
        || event.repeat
        || event.shiftKey
        || dialogOpen
        || correctionDialogOpen
        || isTypingTarget(event.target)
      ) {
        return
      }

      const shortcut = event.key.toLowerCase()

      if (shortcut === 'a' && ready && !busy) {
        event.preventDefault()
        onApprove()
      } else if (shortcut === 'r' && ready && !busy) {
        event.preventDefault()
        setDialogOpen(true)
      } else if (shortcut === 'c' && ready && !busy) {
        event.preventDefault()
        setCorrectionDialogOpen(true)
      } else if (shortcut === 'n' && hasNextInvoice && !busy) {
        event.preventDefault()
        onNextInvoice()
      }
    }

    document.addEventListener('keydown', handleShortcut)
    return () => document.removeEventListener('keydown', handleShortcut)
  }, [busy, correctionDialogOpen, dialogOpen, hasNextInvoice, onApprove, onNextInvoice, ready])

  const handleReject = async (reason: string) => {
    const response = await rejectInvoice(invoice.invoiceId, { reason })
    setRejectionReason(reason)
    onStatusChanged(response.status)
  }

  const handleRequestCorrection = async (reason: string) => {
    const response = await requestInvoiceCorrection(invoice.invoiceId, { reason })
    setCorrectionReason(reason)
    onStatusChanged(response.status)
  }

  if (correctionRequested) {
    return (
      <aside aria-label="Approval decision" className="p-5">
        <div className="rounded-md border border-warning/30 bg-warning-muted p-4 text-warning-muted-foreground">
          <h2 className="text-xs font-medium tracking-[0.1px]">Changes requested</h2>
          <p className="mt-1.5 text-xs leading-4">
            The invoice has returned to the requester and is no longer in the approval queue.
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-border p-4">
          <p className="text-xs font-medium tracking-[0.1px] text-muted-foreground">
            Correction instructions
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-foreground">
            {correctionReason}
          </p>
        </div>
      </aside>
    )
  }

  if (rejected) {
    return (
      <aside aria-label="Approval decision" className="p-5">
        <div className="rounded-md bg-destructive p-4 text-destructive-foreground">
          <h2 className="text-xs font-medium tracking-[0.1px]">Invoice rejected</h2>
          <p className="mt-1.5 text-xs leading-4">
            Review the rejection reason, update the invoice, and resubmit it for approval.
          </p>
        </div>

        <div className="mt-5 rounded-lg border border-border p-4">
          <p className="text-xs font-medium tracking-[0.1px] text-muted-foreground">
            Rejection reason
          </p>
          {rejectionReason ? (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-foreground">
              {rejectionReason}
            </p>
          ) : historyError ? (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-destructive">Unable to load the rejection reason.</p>
              <Button
                onClick={() => {
                  setHistoryError(false)
                  setHistoryRetryCount((count) => count + 1)
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Try again
              </Button>
            </div>
          ) : (
            <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
              Loading rejection reason…
            </p>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside aria-label="Approval decision" className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-[-0.25px] text-foreground">Decision</h2>
        <Badge className="gap-1.5 border-success/20 bg-success-muted text-success" variant="outline">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          Auto-advance · On
        </Badge>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        Review the document and contextual data before choosing an action.
      </p>

      {actionError ? (
        <Alert className="mt-5" variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Unable to complete the action</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {ready ? (
        <div className="mt-5 rounded-lg border border-success/20 bg-success-muted p-4">
          <div className="flex items-center gap-2 text-success">
            <BadgeCheck aria-hidden="true" className="size-4" />
            <p className="text-sm font-medium">Ready for decision</p>
          </div>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Required invoice data is present and no blocking alert remains.
          </p>
        </div>
      ) : (
        <Alert className="mt-5" variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Decision blocked</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {blockingReasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-5 space-y-2">
        <Button
          aria-describedby={decisionHelpId}
          aria-label="Approve invoice"
          className="w-full"
          disabled={!ready || busy}
          onClick={onApprove}
          type="button"
        >
          <BadgeCheck aria-hidden="true" />
          {approvalConfirmed ? 'Approved' : isApproving ? 'Approving…' : 'Approve'}
          <KeyboardKey>A</KeyboardKey>
        </Button>
        <Button
          aria-describedby={decisionHelpId}
          aria-label="Reject invoice"
          className="w-full"
          disabled={!ready || busy}
          onClick={() => setDialogOpen(true)}
          type="button"
          variant="destructive"
        >
          <X aria-hidden="true" />
          Reject
          <KeyboardKey>R</KeyboardKey>
        </Button>
        <Button
          aria-describedby={decisionHelpId}
          aria-label="Request correction"
          className="w-full"
          disabled={!ready || busy}
          onClick={() => setCorrectionDialogOpen(true)}
          type="button"
          variant="outline"
        >
          <MessageSquareText aria-hidden="true" />
          Request changes
          <KeyboardKey>C</KeyboardKey>
        </Button>
        <Button
          aria-describedby={decisionHelpId}
          aria-label="Next invoice"
          className="w-full"
          disabled={!hasNextInvoice || busy}
          onClick={onNextInvoice}
          type="button"
          variant="outline"
        >
          <ArrowRight aria-hidden="true" />
          {isLoadingNext ? 'Opening next…' : 'Next invoice'}
          <KeyboardKey>N</KeyboardKey>
        </Button>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3" id={decisionHelpId}>
        <p className="text-xs font-medium text-foreground">After a decision</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          The next pending invoice opens automatically. Use N to skip without deciding.
        </p>
      </div>
      <p className="mt-4 text-center text-[11px] leading-4 text-muted-foreground">
        Tab moves focus · Enter confirms · Esc closes dialogs
      </p>

      <InvoiceCorrectionRequestDialog
        onOpenChange={setCorrectionDialogOpen}
        onRequestCorrection={handleRequestCorrection}
        open={correctionDialogOpen}
      />
      <InvoiceRejectionDialog
        onOpenChange={setDialogOpen}
        onReject={handleReject}
        open={dialogOpen}
      />
    </aside>
  )
}
