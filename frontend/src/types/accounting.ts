import type { AccountingEntry } from '@/types/invoice'

export type AccountingEntryRecord = {
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
