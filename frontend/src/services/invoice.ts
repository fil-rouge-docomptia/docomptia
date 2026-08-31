import { apiBaseUrl } from '@/lib/env'
import { clearAuthToken, getAuthToken } from '@/lib/auth-session'
import { ApiError, authenticatedFetch } from '@/services/api'
import type {
  InvoiceListQuery,
  InvoiceOcrFailureResponse,
  InvoicePage,
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
    response.status === 'ERREUR_OCR' &&
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

export async function retryInvoiceOcr(invoiceId: number): Promise<void> {
  await authenticatedFetch(`${apiBaseUrl}/v1/invoices/${invoiceId}/ocr/retry`, {
    method: 'POST',
  })
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
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/invoices?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<InvoicePage>
}
