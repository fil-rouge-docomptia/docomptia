import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { InvoiceUploadResponse } from '@/types/invoice'

export async function uploadInvoice(file: File, supplierId?: string): Promise<InvoiceUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  if (supplierId?.trim()) {
    formData.append('supplierId', supplierId)
  }

  const response = await authenticatedFetch(`${apiBaseUrl}/v1/invoices/upload`, {
    method: 'POST',
    body: formData,
  })

  return (await response.json()) as InvoiceUploadResponse
}
