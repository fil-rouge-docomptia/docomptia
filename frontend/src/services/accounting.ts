import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { AccountingEntryPage, AccountingEntryRecord } from '@/types/accounting'

export async function listAccountingEntries(
  filters: { page: number; query: string; balanced: string; status: string },
  signal?: AbortSignal,
): Promise<AccountingEntryPage> {
  const params = new URLSearchParams({ page: String(filters.page), size: '8' })
  if (filters.query) params.set('query', filters.query)
  if (filters.balanced) params.set('balanced', filters.balanced)
  if (filters.status) params.set('status', filters.status)
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-entries?${params}`, { signal })
  return response.json() as Promise<AccountingEntryPage>
}

export async function getAccountingEntry(id: number, signal?: AbortSignal): Promise<AccountingEntryRecord> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-entries/${id}`, { signal })
  return response.json() as Promise<AccountingEntryRecord>
}

export async function mutateAccountingLine(
  entryId: number, lineId: number | null, method: 'POST' | 'PATCH' | 'DELETE',
  body: import('@/types/invoice').AccountingEntryLineCorrectionRequest | undefined,
  version: number, key: string, signal?: AbortSignal,
): Promise<import('@/types/invoice').AccountingEntry> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-entries/${entryId}/lines${lineId === null ? '' : `/${lineId}`}`, {
    method, signal, headers: { 'Content-Type': 'application/json', 'If-Match': `"${version}"`, 'Idempotency-Key': key },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return response.json()
}
