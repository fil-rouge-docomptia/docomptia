export type OcrFieldResponse = {
  fieldName: string
  rawValue: string
  normalizedValue: string
  confidenceScore: string
}

export type OcrAnalysisResponse = {
  status: string
  rawText: string
  confidenceScore: string
  fields: OcrFieldResponse[]
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
  ocrError: {
    code: string
    message: string
    occurredAt: string
  }
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

export type InvoiceListQuery = {
  direction: SortDirection
  page: number
  size: number
  sortBy: InvoiceSortField
}
