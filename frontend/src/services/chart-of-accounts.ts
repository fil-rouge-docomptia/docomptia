import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { ChartOfAccount, PageResponse } from '@/types/onboarding'

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
