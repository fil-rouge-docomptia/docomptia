import { useState } from 'react'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { RoleCode } from '@/types/auth'
import type { InvoiceDetails } from '@/types/invoice'

type InvoiceDetailHeaderProps = {
  invoice: InvoiceDetails
  onRequestApproval: () => Promise<void>
  role?: RoleCode
}

const processingRoles: RoleCode[] = ['ADMIN', 'OPERATEUR_COMPTABLE']

export function InvoiceDetailHeader({
  invoice,
  onRequestApproval,
  role,
}: InvoiceDetailHeaderProps) {
  const [actionError, setActionError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const canRequestApproval =
    invoice.status === 'EXTRAITE' && Boolean(role && processingRoles.includes(role))

  const handleRequestApproval = async () => {
    setActionError(false)
    setSubmitting(true)

    try {
      await onRequestApproval()
    } catch {
      setActionError(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link className="hover:text-foreground" to="/invoices">
              Invoices
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="truncate text-foreground">
              {invoice.invoiceNumber ?? `Invoice ${invoice.invoiceId}`}
            </span>
          </nav>
          <h1 className="truncate text-2xl font-semibold tracking-[-0.5px] text-foreground">
            {invoice.supplierName ?? 'Unknown supplier'}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{invoice.invoiceNumber ?? `Invoice ${invoice.invoiceId}`}</span>
            <span aria-hidden="true">·</span>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>

        {canRequestApproval ? (
          <Button
            className="w-full lg:w-auto"
            disabled={submitting}
            onClick={handleRequestApproval}
            type="button"
          >
            {submitting ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <ArrowRight aria-hidden="true" />
            )}
            {submitting ? 'Requesting…' : 'Request approval'}
          </Button>
        ) : null}
      </div>

      {actionError ? (
        <Alert className="mt-4 border-destructive/30 bg-destructive/5" variant="destructive">
          <AlertDescription>
            The invoice could not be submitted. Check the required fields and try again.
          </AlertDescription>
        </Alert>
      ) : null}
    </header>
  )
}
