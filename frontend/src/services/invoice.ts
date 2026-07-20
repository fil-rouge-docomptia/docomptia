import { apiBaseUrl } from '@/lib/env'
import type { InvoiceUploadResponse } from '@/types/invoice'

export async function uploadInvoice(file: File, supplierId?: string): Promise<InvoiceUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  if (supplierId?.trim()) {
    formData.append('supplierId', supplierId)
  }

  const response = await fetch(`${apiBaseUrl}/v1/invoices/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const responseText = await response.text()
    throw new Error(responseText || 'Upload impossible')
  }

  return (await response.json()) as InvoiceUploadResponse
}
