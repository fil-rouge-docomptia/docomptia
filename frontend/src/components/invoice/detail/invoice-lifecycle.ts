import type { InvoiceDetails } from '@/types/invoice'

export type InvoiceLifecycleNoticeTone = 'destructive' | 'info' | 'neutral' | 'success' | 'warning'

export type InvoiceLifecycleNotice = {
  description: string
  title: string
  tone: InvoiceLifecycleNoticeTone
}

const lifecycleNotices: Record<string, InvoiceLifecycleNotice> = {
  A_VERIFIER: {
    description: 'The invoice was submitted for validation. Open Approval to review its decision context.',
    title: 'Waiting for approval',
    tone: 'warning',
  },
  ARCHIVEE: {
    description: 'This invoice reached its final lifecycle state and is available in read-only mode.',
    title: 'Invoice archived',
    tone: 'neutral',
  },
  COMPTABILISEE: {
    description: 'The accounting entry is complete. Backend checks determine when the invoice becomes exportable.',
    title: 'Accounting complete',
    tone: 'info',
  },
  DEPOSEE: {
    description: 'Processing has not started yet. Review actions become available after OCR has finished.',
    title: 'Invoice received',
    tone: 'neutral',
  },
  EXPORTEE: {
    description: 'The accounting data was exported. This invoice is now available in read-only mode.',
    title: 'Invoice exported',
    tone: 'neutral',
  },
  EXPORTABLE: {
    description: 'Accounting and approval checks are complete. This invoice can be exported.',
    title: 'Ready to export',
    tone: 'success',
  },
  OCR_EN_COURS: {
    description: 'OCR is extracting the invoice data. Review actions are unavailable until processing finishes.',
    title: 'Invoice processing',
    tone: 'info',
  },
  PAYEE: {
    description: 'Payment has been recorded. The invoice remains available in read-only mode.',
    title: 'Invoice paid',
    tone: 'success',
  },
  REJETEE: {
    description: 'Review the rejection reason, update the invoice, and resubmit it for approval.',
    title: 'Invoice rejected',
    tone: 'destructive',
  },
  VALIDEE: {
    description: 'Approval is complete. Review the accounting entry before export.',
    title: 'Invoice approved',
    tone: 'success',
  },
}

const readOnlyStatuses = new Set(['ARCHIVEE', 'EXPORTEE', 'PAYEE'])

export function getInvoiceLifecycleNotice(invoice: InvoiceDetails) {
  if (isInvoiceAccountingUnbalanced(invoice)) {
    return {
      description: 'The accounting entry is unbalanced. Open Accounting and correct its lines before export.',
      title: 'Accounting needs attention',
      tone: 'warning',
    } satisfies InvoiceLifecycleNotice
  }

  return lifecycleNotices[invoice.status] ?? null
}

export function isInvoiceAccountingUnbalanced(invoice: InvoiceDetails) {
  return Boolean(
    invoice.accountingEntry
    && !invoice.accountingEntry.balanced
    && ['COMPTABILISEE', 'VALIDEE'].includes(invoice.status),
  )
}

export function isInvoiceReadOnlyStatus(status: string) {
  return readOnlyStatuses.has(status)
}
