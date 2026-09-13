import { useEffect, useState } from 'react'
import { getOrganizationAccounts } from '@/services/chart-of-accounts'
import { listClassifications } from '@/services/classification'
import type { ChartOfAccount } from '@/types/onboarding'
import type { Classification } from '@/types/classification'

export function useAccountingReferences() {
  const [retry, setRetry] = useState(0)
  const [result, setResult] = useState<{ retry: number; accounts: ChartOfAccount[]; classifications: Classification[]; error: unknown } | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      const accountsPromise = getOrganizationAccounts(controller.signal)
      const classificationsPromise = (async () => {
        const all: Classification[] = []
        let page = 0
        let total = 1
        while (page < total) {
          const response = await listClassifications({ page, size: 100 }, controller.signal)
          all.push(...response.content)
          total = response.totalPages
          page += 1
        }
        return all.filter((item) => item.active)
      })()
      try {
        const [accounts, classifications] = await Promise.all([accountsPromise, classificationsPromise])
        if (!controller.signal.aborted) setResult({ retry, accounts: accounts.filter((item) => item.active), classifications, error: null })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ retry, accounts: [], classifications: [], error })
      }
    }
    void load()
    return () => controller.abort()
  }, [retry])
  const current = result?.retry === retry ? result : null
  return { accounts: current?.accounts ?? [], classifications: current?.classifications ?? [], loading: !current,
    error: current?.error, reload: () => setRetry((value) => value + 1) }
}
