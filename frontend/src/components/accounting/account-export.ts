import { csvCell } from './account-csv'
import type { ChartOfAccount } from '@/types/onboarding'

export function downloadChartOfAccounts(accounts: ChartOfAccount[]) {
  const rows = [
    ['Account number', 'Label', 'Type', 'Active'],
    ...accounts.map((account) => [account.accountNumber, account.accountLabel, account.accountType, account.active]),
  ]
  const blob = new Blob(['\uFEFF', rows.map((row) => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `chart-of-accounts-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
