import { invoiceStatusLabels } from '@/components/invoice/invoice-status'
import type { InvoiceHistoryItem } from '@/types/invoice'

const fieldLabels: Record<string, string> = {
  assigneeUserId: 'Assignee ID',
  classificationId: 'Classification',
  commandReference: 'Purchase order',
  currencyCode: 'Currency',
  dueDate: 'Due date',
  invoiceDate: 'Invoice date',
  invoiceNumber: 'Invoice number',
  supplierId: 'Supplier ID',
  supplierName: 'Supplier legal name',
  totalHt: 'Subtotal',
  totalTtc: 'Total',
  totalTva: 'Tax',
}

const processingLabels: Record<string, string> = {
  DEPOSEE: 'Invoice uploaded',
  OCR_EN_COURS: 'OCR processing started',
  ERREUR_OCR: 'OCR processing failed',
  ERREUR_TRAITEMENT: 'Invoice processing failed',
  EXTRAITE: 'OCR extraction completed',
}

const duplicateDecisionLabels: Record<string, string> = {
  IGNORE: 'Duplicate alert ignored',
  CONFIRM: 'Duplicate confirmed',
  REJECT: 'Duplicate invoice rejected',
}

const validationDecisionLabels: Record<string, string> = {
  VALIDATION: 'Invoice approved',
  REJECTION: 'Invoice rejected',
  CORRECTION_REQUEST: 'Correction requested',
}

function readableCode(value: string) {
  return value.replaceAll('_', ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

export function activityFieldLabel(field: string) {
  return fieldLabels[field] ?? readableCode(field)
}

export function activityTitle(item: InvoiceHistoryItem) {
  switch (item.type) {
    case 'STATUS_CHANGE':
      return processingLabels[item.action]
        ?? `Status changed to ${invoiceStatusLabels[item.action] ?? readableCode(item.action)}`
    case 'CORRECTION':
      return item.fieldName ? `${activityFieldLabel(item.fieldName)} changed` : 'Invoice corrected'
    case 'DUPLICATE_DECISION':
      return duplicateDecisionLabels[item.action]
        ?? `Duplicate decision: ${readableCode(item.action)}`
    case 'VALIDATION_DECISION':
      return validationDecisionLabels[item.action]
        ?? `Validation decision: ${readableCode(item.action)}`
    case 'ASSIGNMENT':
      return 'Assignee changed'
    case 'COMMENT':
      return 'Comment added'
    case 'ACCOUNTING_ACTION':
      return item.action === 'ACCOUNTING_ENTRY_REVERSED'
        ? 'Accounting entry reversed'
        : readableCode(item.action)
    default:
      return readableCode(item.action || item.type)
  }
}

export function activityAuthor(item: InvoiceHistoryItem) {
  return item.author?.trim() || (item.authorId !== null ? `User #${item.authorId}` : 'Author unavailable')
}

export function activityTimestamp(value: string) {
  const timestamp = value ? new Date(value).getTime() : NaN
  return Number.isNaN(timestamp) ? -Infinity : timestamp
}

export function activityValue(value: string | null) {
  return value === null ? 'Not set' : value === '' ? 'Empty value' : value
}
