import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { ExportFormat, ExportGenerationReceipt, ExportHistory, ExportPreflight, ExportSelection, ExportSummary } from '@/types/export'

const root = `${apiBaseUrl}/v1/accounting-exports`

export async function getExportHistory(filters: Record<string, string>, signal?: AbortSignal): Promise<ExportHistory> {
  const params = new URLSearchParams({ size: '8' })
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  const response = await authenticatedFetch(`${root}?${params}`, { signal })
  return response.json() as Promise<ExportHistory>
}

export async function getExportSummary(signal?: AbortSignal): Promise<ExportSummary> {
  const response = await authenticatedFetch(`${root}/summary`, { signal })
  return response.json() as Promise<ExportSummary>
}

export async function getExportSelection(startDate: string, endDate: string, signal?: AbortSignal): Promise<ExportSelection> {
  const params = new URLSearchParams()
  if (startDate) params.set('startDate', startDate)
  if (endDate) params.set('endDate', endDate)
  const response = await authenticatedFetch(`${root}/selection?${params}`, { signal })
  return response.json() as Promise<ExportSelection>
}

export async function confirmExportSelection(startDate: string, endDate: string, invoiceIds: number[], signal?: AbortSignal): Promise<ExportSelection> {
  const response = await authenticatedFetch(`${root}/selection/confirm`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: startDate || null, endDate: endDate || null, invoiceIds }),
  })
  return response.json() as Promise<ExportSelection>
}

export async function downloadExport(id: number, signal?: AbortSignal): Promise<Blob> {
  const response = await authenticatedFetch(`${root}/${id}/file`, { signal })
  return response.blob()
}

export async function getExportFormats(signal?: AbortSignal): Promise<ExportFormat[]> {
  const response = await authenticatedFetch(`${root}/formats`, { signal })
  const formats: unknown = await response.json()
  if (!Array.isArray(formats)) throw new Error('Invalid export formats response')
  return [...new Set(formats.filter((format): format is ExportFormat => format === 'CSV' || format === 'FEC'))]
}

export async function checkExportFormat(selection: ExportSelection, format: ExportFormat, signal?: AbortSignal): Promise<ExportPreflight> {
  const response = await authenticatedFetch(`${root}/preflight`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: selection.startDate, endDate: selection.endDate,
      invoiceIds: selection.invoices.map((invoice) => invoice.invoiceId), format }),
  })
  return response.json() as Promise<ExportPreflight>
}

export async function generateExport(selection: ExportSelection, format: ExportFormat, signal?: AbortSignal): Promise<ExportGenerationReceipt> {
  const response = await authenticatedFetch(`${root}/generate`, {
    method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: selection.startDate, endDate: selection.endDate,
      invoiceIds: selection.invoices.map((invoice) => invoice.invoiceId), format }),
  })
  const receipt = await response.json() as ExportGenerationReceipt | null
  if (!receipt || !Number.isSafeInteger(receipt.exportBatchId) || receipt.exportBatchId <= 0
    || receipt.organizationId !== selection.organizationId || receipt.format !== format || receipt.status !== 'GENERE'
    || typeof receipt.fileName !== 'string' || !receipt.fileName.trim()
    || !Number.isSafeInteger(receipt.fileSize) || receipt.fileSize < 0
    || typeof receipt.generatedAt !== 'string' || !Number.isFinite(Date.parse(receipt.generatedAt))
    || typeof receipt.createdByName !== 'string'
    || !Array.isArray(receipt.invoiceIds) || receipt.invoiceIds.length !== selection.invoices.length
    || !selection.invoices.every((invoice) => receipt.invoiceIds.includes(invoice.invoiceId))) {
    throw new Error('The generated batch receipt is incomplete or does not match the requested selection')
  }
  return receipt
}
