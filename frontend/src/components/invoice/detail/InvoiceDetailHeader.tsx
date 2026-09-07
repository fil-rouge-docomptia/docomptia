import { useState } from 'react'
import { ArrowRight, LoaderCircle, RotateCcw, Save } from 'lucide-react'
import { Link } from 'react-router-dom'

import { InvoiceStatusBadge } from '@/components/invoice/InvoiceStatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { RoleCode } from '@/types/auth'
import type { InvoiceDetails, InvoiceDuplicateAlert } from '@/types/invoice'

import {
  canCorrectInvoice,
  canProcessInvoice,
  isRetryableOcrError,
} from './invoice-detail-utils'
import { isInvoiceAccountingUnbalanced } from './invoice-lifecycle'

type CorrectionState = {
  dirty: boolean
  saving: boolean
}

type InvoiceDetailHeaderProps = {
  correctionState: CorrectionState
  duplicateAlert: InvoiceDuplicateAlert | null
  duplicateDecisionPending: boolean
  invoice: InvoiceDetails
  onIgnoreDuplicate: () => Promise<void>
  onRequestApproval: () => Promise<void>
  onReviewDuplicate: () => void
  onRetryOcr: () => Promise<void>
  role?: RoleCode
  showCorrectionAction: boolean
}

export function InvoiceDetailHeader({
  correctionState,
  duplicateAlert,
  duplicateDecisionPending,
  invoice,
  onIgnoreDuplicate,
  onRequestApproval,
  onReviewDuplicate,
  onRetryOcr,
  role,
  showCorrectionAction,
}: InvoiceDetailHeaderProps) {
  const [actionError, setActionError] = useState<'approval' | 'duplicate' | 'ocr' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [retryingOcr, setRetryingOcr] = useState(false)
  const canProcess = canProcessInvoice(role)
  const hasPendingDuplicate = Boolean(duplicateAlert)
  const accountingUnbalanced = isInvoiceAccountingUnbalanced(invoice)
  const canRequestApproval =
    invoice.status === 'EXTRAITE' && canProcess && !hasPendingDuplicate
  const canRetryOcr = invoice.status === 'ERREUR_OCR'
    && canProcess
    && isRetryableOcrError(invoice.ocrError)
  const canSaveCorrections = showCorrectionAction
    && canCorrectInvoice(invoice.status, role)
    && !canRetryOcr

  const handleRequestApproval = async () => {
    setActionError(null)
    setSubmitting(true)

    try {
      await onRequestApproval()
    } catch {
      setActionError('approval')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetryOcr = async () => {
    setActionError(null)
    setRetryingOcr(true)

    try {
      await onRetryOcr()
    } catch {
      setActionError('ocr')
    } finally {
      setRetryingOcr(false)
    }
  }

  const handleIgnoreDuplicate = async () => {
    setActionError(null)

    try {
      await onIgnoreDuplicate()
    } catch {
      setActionError('duplicate')
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
            <InvoiceStatusBadge
              className={accountingUnbalanced && !hasPendingDuplicate
                ? 'border-destructive bg-destructive text-destructive-foreground'
                : undefined}
              label={accountingUnbalanced && !hasPendingDuplicate
                ? 'Accounting unbalanced'
                : undefined}
              status={hasPendingDuplicate ? 'DUPLICATE_SUSPECTED' : invoice.status}
            />
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
          {canSaveCorrections && (!hasPendingDuplicate || correctionState.dirty) ? (
            <Button
              className="w-full lg:w-auto"
              disabled={!correctionState.dirty || correctionState.saving}
              form="invoice-correction-form"
              type="submit"
              variant="secondary"
            >
              {correctionState.saving ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {correctionState.saving ? 'Saving…' : 'Save'}
            </Button>
          ) : null}

          {hasPendingDuplicate && canProcess ? (
            <Button
              className="w-full lg:w-auto"
              disabled={duplicateDecisionPending || correctionState.dirty}
              onClick={() => void handleIgnoreDuplicate()}
              type="button"
              variant="secondary"
            >
              {duplicateDecisionPending ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : null}
              {duplicateDecisionPending ? 'Updating…' : 'Not a duplicate'}
            </Button>
          ) : null}

          {hasPendingDuplicate ? (
            <Button
              className="w-full lg:w-auto"
              disabled={duplicateDecisionPending}
              onClick={onReviewDuplicate}
              type="button"
            >
              Review duplicate
            </Button>
          ) : null}

          {canRetryOcr ? (
            <Button
              className="w-full lg:w-auto"
              disabled={retryingOcr}
              onClick={handleRetryOcr}
              type="button"
            >
              {retryingOcr ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" />
              ) : (
                <RotateCcw aria-hidden="true" />
              )}
              {retryingOcr ? 'Retrying OCR…' : 'Retry OCR'}
            </Button>
          ) : null}

          {canRequestApproval ? (
            <Button
              className="w-full lg:w-auto"
              disabled={submitting || correctionState.dirty}
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
      </div>

      {actionError ? (
        <Alert className="mt-4 border-destructive/30 bg-destructive/5" variant="destructive">
          <AlertDescription>
            {actionError === 'ocr'
              ? 'OCR could not be restarted. The original file is still available.'
              : actionError === 'duplicate'
                ? 'The duplicate decision could not be saved. Review the match and try again.'
              : 'The invoice could not be submitted. Check the required fields and try again.'}
          </AlertDescription>
        </Alert>
      ) : null}
    </header>
  )
}
