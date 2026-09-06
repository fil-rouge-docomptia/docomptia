import type { InvoiceHistoryItem } from '@/types/invoice'

export type InvoiceApprovalHistoryContext = {
  rejected: InvoiceHistoryItem | null
  requested: InvoiceHistoryItem | null
  reviewed: InvoiceHistoryItem | null
  uploaded: InvoiceHistoryItem | null
}

export function getInvoiceApprovalHistoryContext(
  history: InvoiceHistoryItem[],
): InvoiceApprovalHistoryContext {
  const statusHistory = history.filter((item) => item.type === 'STATUS_CHANGE')

  return {
    rejected: history.findLast((item) => (
      item.type === 'VALIDATION_DECISION' && item.action === 'REJECTION'
    )) ?? statusHistory.findLast((item) => item.action === 'REJETEE') ?? null,
    requested: statusHistory.findLast((item) => item.action === 'A_VERIFIER') ?? null,
    reviewed: statusHistory.findLast((item) => item.action === 'EXTRAITE') ?? null,
    uploaded: statusHistory.find((item) => item.action === 'DEPOSEE') ?? null,
  }
}

export function formatApprovalDate(value?: string | null, includeTime = true) {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en-GB', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date)
}
