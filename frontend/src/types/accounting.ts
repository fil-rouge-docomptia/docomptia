import type { AccountingEntry } from '@/types/invoice'

export type AccountingEntryRecord = {
  journal?: AccountingJournal | null
  exportStatus?: 'NOT_EXPORTED' | 'EXPORTED'
  exportBatchId?: number | null
  exportedAt?: string | null
  exportEligible?: boolean
  needsAttention?: boolean
  diagnostics?: import('./invoice').AccountingDiagnostic[]
  invoiceId: number
  invoiceNumber: string | null
  supplierName: string | null
  currencyCode: string | null
  invoiceStatus: string
  entry: AccountingEntry & { reversedAccountingEntryId: number | null }
}

export type AccountingEntryPage = {
  content: AccountingEntryRecord[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type AccountingJournal = {
  accountingJournalId: number
  code: string
  label: string
  active: boolean
}
