export type ExportStatus = 'PREPARATION' | 'GENERE' | 'ARCHIVE'
export type ExportFormat = 'CSV' | 'FEC'

export type ExportBatch = {
  exportBatchId: number
  createdAt: string | null
  periodStartDate: string | null
  periodEndDate: string | null
  format: ExportFormat
  status: ExportStatus
  fileName: string | null
  createdByName: string
  invoiceCount: number
  amounts: { currencyCode: string | null; amount: number }[]
  downloadable: boolean
}

export type ExportHistory = {
  content: ExportBatch[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type ExportSummary = {
  readyToExport: number
  blockedInvoices: number
  exportedThisMonth: number
  monthStart: string
  monthEnd: string
}

export type ExportCandidate = {
  invoiceId: number
  invoiceNumber: string | null
  invoiceDate: string | null
  supplierName: string | null
  currencyCode: string | null
  invoiceAmount: number | null
  eligible: boolean
  totalDebit: number | null
  totalCredit: number | null
  errors: { code: string; message: string }[]
}

export type ExportTotals = {
  currencyCode: string | null
  totalDebit: number
  totalCredit: number
  invoiceAmount: number
}

export type ExportSelection = {
  organizationId: number
  organizationName: string
  startDate: string | null
  endDate: string | null
  invoices: ExportCandidate[]
  totals: ExportTotals[]
}
