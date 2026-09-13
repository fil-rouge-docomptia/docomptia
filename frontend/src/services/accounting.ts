import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { AccountingEntryPage, AccountingEntryRecord } from '@/types/accounting'

export type AccountingEntryFilters = {
  page: number; query: string; balanced: string; status: string
  startDate?: string; endDate?: string; journalId?: string; exportStatus?: string
  sortBy?: string; direction?: string; view?: string
}

export async function listAccountingEntries(filters: AccountingEntryFilters, signal?: AbortSignal): Promise<AccountingEntryPage> {
  const completeView = filters.view === 'attention' || filters.view === 'ready'
  const params = new URLSearchParams({ page: String(completeView ? 0 : filters.page), size: completeView ? '100' : '8' })
  for (const key of ['query', 'balanced', 'status', 'startDate', 'endDate', 'journalId', 'exportStatus', 'sortBy', 'direction'] as const) {
    if (filters[key]) params.set(key, filters[key])
  }
  const read = async () => {
    const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-entries?${params}`, { signal })
    return response.json() as Promise<AccountingEntryPage>
  }
  const first = await read()
  if (!completeView) return first
  // The API exposes these diagnostics but cannot filter them. Load the complete result before paging.
  const all = [...first.content]
  for (let page = 1; page < first.totalPages; page += 1) {
    params.set('page', String(page))
    all.push(...(await read()).content)
  }
  const filtered = all.filter((item) => filters.view === 'attention' ? item.needsAttention === true : item.exportEligible === true)
  return { content: filtered.slice(filters.page * 8, (filters.page + 1) * 8), number: filters.page,
    size: 8, totalElements: filtered.length, totalPages: Math.ceil(filtered.length / 8) }
}

export async function getAccountingJournals(signal?: AbortSignal): Promise<import('@/types/accounting').AccountingJournal[]> {
  const all: import('@/types/accounting').AccountingJournal[] = []
  let page = 0
  let total = 1
  while (page < total) {
    const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-journals?page=${page}&size=100`, { signal })
    const result = await response.json() as { content: import('@/types/accounting').AccountingJournal[]; totalPages: number }
    all.push(...result.content)
    total = result.totalPages
    page += 1
  }
  return all
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
