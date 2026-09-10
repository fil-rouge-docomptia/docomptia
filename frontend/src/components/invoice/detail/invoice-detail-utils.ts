import type { RoleCode } from '@/types/auth'
import type {
  InvoiceDetails,
  InvoiceOcrError,
  OcrFieldResponse,
} from '@/types/invoice'

const correctionStatuses = [
  'A_VERIFIER',
  'ERREUR_OCR',
  'ERREUR_TRAITEMENT',
  'EXTRAITE',
  'REJETEE',
]
const correctionRoles: RoleCode[] = ['ADMIN', 'OPERATEUR_COMPTABLE']
const nonRetryableOcrErrorCodes = new Set([
  'OCR_FILE_READ_FAILED',
  'OCR_SERVICE_REJECTED',
  'OCR_SUPPLIER_RESOLUTION_FAILED',
])

export function canCorrectInvoice(status: string, role?: RoleCode) {
  return Boolean(
    role
    && correctionRoles.includes(role)
    && correctionStatuses.includes(status),
  )
}

export function canProcessInvoice(role?: RoleCode) {
  return Boolean(role && correctionRoles.includes(role))
}

export function canValidateInvoice(role?: RoleCode) {
  return role === 'RESPONSABLE_COMPTABLE'
}

export function isRetryableOcrError(error: InvoiceOcrError | null) {
  return !error || !nonRetryableOcrErrorCodes.has(error.code)
}

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
