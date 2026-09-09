import type { ChartOfAccount } from '@/types/onboarding'

export const accountColumns = [
  { key: 'accountNumber', label: 'Account number' },
  { key: 'accountLabel', label: 'Label' },
  { key: 'accountType', label: 'Type' },
  { key: 'active', label: 'Status' },
] as const

export type AccountSortColumn = typeof accountColumns[number]['key']

const collator = new Intl.Collator('fr', { numeric: true, sensitivity: 'base' })

export function compareAccounts(left: ChartOfAccount, right: ChartOfAccount, column: AccountSortColumn) {
  const comparison = column === 'active'
    ? Number(right.active) - Number(left.active)
    : collator.compare(left[column], right[column])
  return comparison || collator.compare(left.accountNumber, right.accountNumber) || left.accountId - right.accountId
}

export function normalizeAccountSearch(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('fr').trim()
}
