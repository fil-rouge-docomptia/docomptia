import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { ChartOfAccount, ChartOfAccountInput, PageResponse } from '@/types/onboarding'

// The API only paginates: load every page before searching or sorting the plan.
export async function getOrganizationAccounts(signal: AbortSignal): Promise<ChartOfAccount[]> {
  const accounts: ChartOfAccount[] = []
  let pageNumber = 0
  let totalPages = 1

  while (pageNumber < totalPages) {
    const response = await authenticatedFetch(
      `${apiBaseUrl}/v1/chart-of-accounts?page=${pageNumber}&size=100`,
      { signal },
    )
    const page = await response.json() as PageResponse<ChartOfAccount>
    accounts.push(...page.content)
    totalPages = page.totalPages
    pageNumber += 1
  }

  return accounts
}

export async function createAccount(input: ChartOfAccountInput, signal: AbortSignal): Promise<ChartOfAccount> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/chart-of-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  return response.json()
}

export async function updateAccount(id: number, input: Partial<ChartOfAccountInput>, signal: AbortSignal): Promise<ChartOfAccount> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/chart-of-accounts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  return response.json()
}

export async function deactivateAccount(id: number, signal: AbortSignal): Promise<ChartOfAccount> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/chart-of-accounts/${id}/deactivate`, {
    method: 'POST',
    signal,
  })
  return response.json()
}
