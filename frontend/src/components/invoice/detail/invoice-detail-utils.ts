import type { InvoiceDetails, OcrFieldResponse } from '@/types/invoice'

export function formatInvoiceDate(value: string | null) {
  if (!value) {
    return 'Not available'
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(date)
}

export function formatInvoiceMoney(
  value: string | null,
  currencyCode: string | null,
) {
  if (!value) {
    return 'Not available'
  }

  const amount = Number(value)
  if (!Number.isFinite(amount)) {
    return value
  }

  try {
    return new Intl.NumberFormat('en-GB', {
      currency: currencyCode ?? 'EUR',
      currencyDisplay: 'symbol',
      style: 'currency',
    }).format(amount)
  } catch {
    return `${value} ${currencyCode ?? ''}`.trim()
  }
}

export function getInvoiceFileName(filePath: string | null, invoiceNumber: string | null) {
  if (filePath) {
    const fileName = filePath.split(/[\\/]/).at(-1)
    if (fileName) {
      return fileName
    }
  }

  return `${invoiceNumber ?? 'Invoice'}.pdf`
}

export function getOcrField(invoice: InvoiceDetails, fieldName: string) {
  return invoice.ocrAnalysis?.fields.find((field) => field.fieldName === fieldName)
}

export function getConfidencePercent(field?: OcrFieldResponse) {
  if (!field?.confidenceScore) {
    return null
  }

  const score = Number(field.confidenceScore)
  if (!Number.isFinite(score)) {
    return null
  }

  return Math.round((score <= 1 ? score : score / 100) * 100)
}

export function isLowConfidence(field?: OcrFieldResponse) {
  const confidence = getConfidencePercent(field)
  return confidence !== null && confidence < 85
}
