import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { ExportHistory, ExportSelection, ExportSummary } from '@/types/export'

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
