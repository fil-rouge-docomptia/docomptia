import { BadgeCheck, CircleAlert, MessageSquareText, X } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
  role,
}: {
  invoice: InvoiceDetails
  role?: RoleCode
}) {
  const blockingReasons = getBlockingReasons(invoice, role)
  const ready = blockingReasons.length === 0
  const decisionHelpId = `approval-decision-help-${invoice.invoiceId}`

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
        <Button
          aria-describedby={decisionHelpId}
          className="w-full"
          disabled
          type="button"
          variant="destructive"
        >
          <X aria-hidden="true" />
          Reject invoice
        </Button>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted-foreground" id={decisionHelpId}>
        Decision actions will be activated by the approval, correction and rejection workflows.
      </p>
    </aside>
  )
}
