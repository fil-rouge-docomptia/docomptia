import { useEffect, useState } from 'react'
import { BadgeCheck, CircleAlert, MessageSquareText, X } from 'lucide-react'

import { InvoiceRejectionDialog } from '@/components/approval/InvoiceRejectionDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getInvoiceHistory, rejectInvoice } from '@/services/invoice'
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

export function ApprovalDecisionPanel({
  invoice,
  onRejected,
  role,
}: {
  invoice: InvoiceDetails
  onRejected: (status: string) => void
  role?: RoleCode
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState(false)
  const [historyRetryCount, setHistoryRetryCount] = useState(0)
  const blockingReasons = getBlockingReasons(invoice, role)
  const ready = blockingReasons.length === 0
  const decisionHelpId = `approval-decision-help-${invoice.invoiceId}`
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
    if (!ready || rejected || dialogOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      const editing = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
      )

      if (
        !editing &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'r'
      ) {
        event.preventDefault()
        setDialogOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [dialogOpen, ready, rejected])

  const handleReject = async (reason: string) => {
    const response = await rejectInvoice(invoice.invoiceId, { reason })
    setRejectionReason(reason)
    onRejected(response.status)
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
      <h2 className="text-sm font-semibold text-foreground">Decision</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Review the document and contextual data before choosing an action.
      </p>

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
          className="w-full"
          disabled
          type="button"
        >
          <BadgeCheck aria-hidden="true" />
          Approve invoice
        </Button>
        <Button
          aria-describedby={decisionHelpId}
          className="w-full"
          disabled
          type="button"
          variant="outline"
        >
          <MessageSquareText aria-hidden="true" />
          Request correction
        </Button>
        <div className="flex items-center gap-2">
          <Button
            aria-describedby={decisionHelpId}
            className="w-full"
            disabled={!ready}
            onClick={() => setDialogOpen(true)}
            type="button"
            variant="destructive"
          >
            <X aria-hidden="true" />
            Reject invoice
          </Button>
          <Badge className="h-6 w-9 justify-center" variant="outline">R</Badge>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground" id={decisionHelpId}>
        {ready
          ? 'Select Reject invoice or press R to record a rejection reason.'
          : 'Resolve the blocking items before choosing a decision.'}
      </p>

      <InvoiceRejectionDialog
        onOpenChange={setDialogOpen}
        onReject={handleReject}
        open={dialogOpen}
      />
    </aside>
  )
}
