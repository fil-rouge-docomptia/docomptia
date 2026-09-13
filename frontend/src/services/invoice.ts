import { apiBaseUrl } from '@/lib/env'
import { clearAuthToken, getAuthToken } from '@/lib/auth-session'
import { ApiError, authenticatedFetch } from '@/services/api'
import type {
  AccountingEntry,
  AccountingEntryLineCorrectionRequest,
  InvoiceCorrectionDemandRequest,
  InvoiceCorrectionRequest,
  InvoiceDetails,
  InvoiceDuplicateDecisionRequest,
  InvoiceHistoryItem,
  InvoiceListQuery,
  InvoicePageQuery,
  InvoiceOcrFailureResponse,
  InvoicePage,
  InvoiceRejectionRequest,
  InvoiceStatusResponse,
  InvoiceUploadResponse,
} from '@/types/invoice'

type UploadInvoiceOptions = {
  onUploadComplete?: () => void
  onUploadProgress?: (progress: number) => void
}

type ApiErrorPayload = {
  code?: string
  message?: string
}

function parseJson<T>(value: string): T | null {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function isInvoiceOcrFailureResponse(
  value: unknown,
): value is InvoiceOcrFailureResponse {
  if (!value || typeof value !== 'object') {
    return false
  }

  const response = value as Partial<InvoiceOcrFailureResponse>
  return (
    typeof response.invoiceId === 'number' &&
    (response.status === 'ERREUR_OCR' || response.status === 'ERREUR_TRAITEMENT') &&
    Boolean(response.ocrError)
  )
}

export function uploadInvoice(
  file: File,
  options: UploadInvoiceOptions = {},
): Promise<InvoiceUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    const token = getAuthToken()

    request.open('POST', `${apiBaseUrl}/v1/invoices/upload`)

    if (token) {
      request.setRequestHeader('Authorization', `Bearer ${token}`)
    }

    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        options.onUploadProgress?.(Math.round((event.loaded / event.total) * 100))
      }
    })

    request.upload.addEventListener('load', () => {
      options.onUploadProgress?.(100)
      options.onUploadComplete?.()
    })

    request.addEventListener('load', () => {
      const payload = parseJson<InvoiceUploadResponse | InvoiceOcrFailureResponse | ApiErrorPayload>(
        request.responseText,
      )

      if (request.status >= 200 && request.status < 300 && payload) {
        resolve(payload as InvoiceUploadResponse)
        return
      }

      if (request.status === 401) {
        clearAuthToken()
      }

      const apiError = payload as ApiErrorPayload | null
      reject(
        new ApiError(
          request.status,
          apiError?.code,
          apiError?.message,
          payload,
        ),
      )
    })

    request.addEventListener('error', () => {
      reject(new ApiError(0, undefined, 'The API request failed'))
    })

    request.send(formData)
  })
}

export async function retryInvoiceOcr(invoiceId: number): Promise<InvoiceDetails> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/invoices/${invoiceId}/ocr/retry`, {
    method: 'POST',
  })

  return response.json() as Promise<InvoiceDetails>
}

export async function listInvoices(
  query: InvoiceListQuery,
  signal?: AbortSignal,
): Promise<InvoicePage> {
  const searchParams = new URLSearchParams({
    direction: query.direction,
    page: String(query.page),
    size: String(query.size),
    sortBy: query.sortBy,
  })

  query.status?.forEach((status) => searchParams.append('status', status))

  const optionalFilters = {
    client: query.client,
    dueDate: query.dueDate,
    endDate: query.endDate,
    invoiceDate: query.invoiceDate,
    invoiceNumber: query.invoiceNumber,
    maxAmount: query.maxAmount,
    minAmount: query.minAmount,
    startDate: query.startDate,
    supplier: query.supplier,
  }

  Object.entries(optionalFilters).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value)
    }
  })

  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<InvoicePage>
}

export async function listPendingValidationInvoices(
  query: InvoicePageQuery,
  signal?: AbortSignal,
): Promise<InvoicePage> {
  const searchParams = new URLSearchParams({
    direction: query.direction,
    page: String(query.page),
    size: String(query.size),
    sortBy: query.sortBy,
  })

  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/pending-validation?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<InvoicePage>
}

export async function getInvoiceDetails(
  invoiceId: number,
  signal?: AbortSignal,
): Promise<InvoiceDetails> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}`,
    { signal },
  )

  return response.json() as Promise<InvoiceDetails>
}

export async function correctInvoice(
  invoiceId: number,
  corrections: InvoiceCorrectionRequest,
): Promise<InvoiceDetails> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}`,
    {
      body: JSON.stringify(corrections),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  )

  return response.json() as Promise<InvoiceDetails>
}

export async function correctAccountingEntryLine(
  entryId: number,
  lineId: number,
  correction: AccountingEntryLineCorrectionRequest,
): Promise<AccountingEntry> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/accounting-entries/${entryId}/lines/${lineId}`,
    {
      body: JSON.stringify(correction),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  )

  return response.json() as Promise<AccountingEntry>
}

export async function decideInvoiceDuplicateAlert(
  invoiceId: number,
  alertId: number,
  decision: InvoiceDuplicateDecisionRequest,
): Promise<InvoiceDetails> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/duplicate-alerts/${alertId}/decision`,
    {
      body: JSON.stringify(decision),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )

  return response.json() as Promise<InvoiceDetails>
}

export async function getInvoiceHistory(
  invoiceId: number,
  signal?: AbortSignal,
): Promise<InvoiceHistoryItem[]> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/history`,
    { signal },
  )

  return response.json() as Promise<InvoiceHistoryItem[]>
}

export async function getInvoiceFile(
  invoiceId: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/file`,
    { signal },
  )

  return response.blob()
}

export async function getInvoicePreview(
  invoiceId: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/preview`,
    { signal },
  )

  return response.blob()
}

export async function submitInvoiceForValidation(
  invoiceId: number,
): Promise<InvoiceStatusResponse> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/submit-for-validation`,
    { method: 'POST' },
  )

  return response.json() as Promise<InvoiceStatusResponse>
}

export async function approveInvoice(
  invoiceId: number,
): Promise<InvoiceStatusResponse> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/validate`,
    { method: 'POST' },
  )

  return response.json() as Promise<InvoiceStatusResponse>
}

export async function rejectInvoice(
  invoiceId: number,
  request: InvoiceRejectionRequest,
): Promise<InvoiceStatusResponse> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/reject`,
    {
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )

  return response.json() as Promise<InvoiceStatusResponse>
}

export async function requestInvoiceCorrection(
  invoiceId: number,
  request: InvoiceCorrectionDemandRequest,
): Promise<InvoiceStatusResponse> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices/${invoiceId}/request-correction`,
    {
      body: JSON.stringify(request),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  )

  return response.json() as Promise<InvoiceStatusResponse>
}

export async function generateInvoiceAccountingEntry(invoiceId: number, signal?: AbortSignal): Promise<{
  invoiceId: number; status: string; accountingEntry: AccountingEntry
}> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/invoices/${invoiceId}/accounting-entry`, {
    method: 'POST', signal,
  })
  return response.json()
}
