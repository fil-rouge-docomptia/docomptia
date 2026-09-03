export type OcrFieldResponse = {
  fieldName: string
  rawValue: string
  normalizedValue: string
  confidenceScore: string
  corrected?: boolean
}

export type OcrAnalysisResponse = {
  status: string
  engineName?: string
  engineVersion?: string
  rawText: string
  confidenceScore: string
  fields: OcrFieldResponse[]
}

export type InvoiceOcrError = {
  code: string
  message: string
  occurredAt: string
}

export type InvoiceUploadResponse = {
  invoiceId: number
  invoiceNumber: string
  status: string
  ocrAnalysis: OcrAnalysisResponse
}

export type InvoiceOcrFailureResponse = {
  invoiceId: number
  status: string
  ocrError: InvoiceOcrError
}

export type InvoiceUploadPhase =
  | 'empty'
  | 'queued'
  | 'uploading'
  | 'ocr-processing'
  | 'completed'
  | 'upload-error'
  | 'ocr-error'

export type InvoiceListItem = {
  invoiceId: number
  invoiceNumber: string | null
  invoiceDate: string | null
  dueDate: string | null
  status: string
  supplierName: string | null
  currencyCode: string | null
  totalTtc: string | null
}

export type InvoicePage = {
  content: InvoiceListItem[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type InvoiceSortField = 'createdAt' | 'invoiceDate' | 'totalTtc' | 'status'
export type SortDirection = 'ASC' | 'DESC'

export type InvoiceListFilters = {
  client?: string
  dueDate?: string
  endDate?: string
  invoiceDate?: string
  invoiceNumber?: string
  maxAmount?: string
  minAmount?: string
  startDate?: string
  status?: string[]
  supplier?: string
}

export type InvoiceFilterUpdates = {
  [Key in keyof InvoiceListFilters]?: InvoiceListFilters[Key]
}

export type InvoiceListQuery = InvoiceListFilters & {
  direction: SortDirection
  page: number
  size: number
  sortBy: InvoiceSortField
}

export type InvoiceClassification = {
  classificationId: number
  type: string
  name: string
  description: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export type AccountingEntryLine = {
  accountingEntryLineId: number
  lineNumber: number
  accountNumber: string
  accountLabel: string
  lineLabel: string
  debitAmount: string
  creditAmount: string
}

export type AccountingEntry = {
  accountingEntryId: number
  entryNumber: string
  entryDate: string
  label: string
  status: string
  totalDebit: string
  totalCredit: string
  balanceDifference: string
  balanced: boolean
  lines: AccountingEntryLine[]
}

export type InvoiceDuplicateAlert = {
  alertId: number
  type: string
  matchingInvoiceId: number | null
  matchingInvoiceNumber: string | null
  supplierId: number | null
  invoiceDate: string | null
  totalTtc: string | null
  confidenceLevel: string | null
  createdAt: string
  decision: string | null
  decidedByUserId: number | null
  decidedAt: string | null
  decisionReason: string | null
}

export type InvoiceDuplicateDecision = 'CONFIRM' | 'IGNORE' | 'REJECT'

export type InvoiceDuplicateDecisionRequest = {
  decision: InvoiceDuplicateDecision
  reason?: string
}

export type InvoiceSupplier = {
  confirmed: boolean
  currentCountryCode: string | null
  currentLegalName: string
  currentTradeName: string | null
  snapshotAddress: string | null
  snapshotIdentifiers: string | null
  snapshotLegalName: string | null
  supplierId: number
}

export type InvoiceDetails = {
  invoiceId: number
  invoiceNumber: string | null
  commandReference: string | null
  invoiceDate: string | null
  dueDate: string | null
  status: string
  supplier: InvoiceSupplier | null
  supplierName: string | null
  classification: InvoiceClassification | null
  currencyCode: string | null
  totalHt: string | null
  totalTva: string | null
  totalTtc: string | null
  filePath: string | null
  ocrAnalysis: OcrAnalysisResponse | null
  ocrError: InvoiceOcrError | null
  accountingEntry: AccountingEntry | null
  duplicateAlerts: InvoiceDuplicateAlert[]
}

export type InvoiceCorrectionRequest = {
  commandReference?: string
  dueDate?: string
  invoiceDate?: string
  invoiceNumber?: string
  supplierId?: number
  totalHt?: string
  totalTtc?: string
  totalTva?: string
}

export type InvoiceHistoryItem = {
  type: string
  action: string
  date: string
  authorId: number | null
  author: string | null
  fieldName: string | null
  oldValue: string | null
  newValue: string | null
  comment: string | null
  duplicateAlertId: number | null
}

export type InvoiceStatusResponse = {
  invoiceId: number
  status: string
}
