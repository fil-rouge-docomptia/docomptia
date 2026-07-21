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
