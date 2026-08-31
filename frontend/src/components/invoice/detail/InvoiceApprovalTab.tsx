import { CircleCheck, CircleDashed, LockKeyhole } from 'lucide-react'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import type { RoleCode } from '@/types/auth'
import type { InvoiceDetails } from '@/types/invoice'

type InvoiceApprovalTabProps = {
  invoice: InvoiceDetails
  role?: RoleCode
}

function approvalMessage(invoice: InvoiceDetails, role?: RoleCode) {
  if (invoice.status === 'A_VERIFIER') {
    return role === 'RESPONSABLE_COMPTABLE'
      ? 'This invoice is ready for your accounting decision.'
      : 'This invoice is waiting for a decision from an accounting manager.'
  }

  if (invoice.status === 'EXTRAITE') {
    return role === 'RESPONSABLE_COMPTABLE'
      ? 'The accounting team must complete its review before this invoice reaches you.'
      : 'Review the extracted fields, then request approval from the invoice header.'
  }

  if (['VALIDEE', 'COMPTABILISEE', 'EXPORTABLE', 'EXPORTEE', 'ARCHIVEE'].includes(invoice.status)) {
    return 'The approval step has been completed for this invoice.'
  }

  if (invoice.status === 'REJETEE') {
    return 'This invoice was rejected and cannot proceed without a correction.'
  }

  return 'Approval becomes available after invoice extraction and review are complete.'
}

export function InvoiceApprovalTab({ invoice, role }: InvoiceApprovalTabProps) {
  const completed = ['VALIDEE', 'COMPTABILISEE', 'EXPORTABLE', 'EXPORTEE', 'ARCHIVEE'].includes(
    invoice.status,
  )

  return (
    <div className="p-4">
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
              {approvalMessage(invoice, role)}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
