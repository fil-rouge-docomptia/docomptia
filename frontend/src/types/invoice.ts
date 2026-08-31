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
