import type { InvoiceListItem } from '@/types/invoice'

const fileExtensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
}

export function getDocumentName(invoice: InvoiceListItem) {
  return invoice.invoiceNumber
    ? `Invoice ${invoice.invoiceNumber}`
    : `Invoice #${invoice.invoiceId}`
}

export function getDocumentFileName(invoice: InvoiceListItem, blob: Blob) {
  const extension = fileExtensions[blob.type] ?? 'file'
  const baseName = invoice.invoiceNumber ?? `invoice-${invoice.invoiceId}`
  return `${baseName}.${extension}`
}

export function getDocumentTypeLabel(mimeType: string) {
  if (mimeType === 'application/pdf') {
    return 'PDF document'
  }

  if (mimeType.startsWith('image/')) {
    return 'Invoice image'
  }

  return 'Invoice document'
}
