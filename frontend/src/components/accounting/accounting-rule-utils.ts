import type { AccountingRuleAccount } from '@/types/onboarding'

export const ruleAccountFields = [
  { key: 'expenseAccount', updateKey: 'expenseAccountId', label: 'Expense account' },
  { key: 'vatAccount', updateKey: 'vatAccountId', label: 'VAT account' },
  { key: 'supplierAccount', updateKey: 'supplierAccountId', label: 'Supplier account' },
] as const

export function accountLabel(account: AccountingRuleAccount | null) {
  return account ? `${account.accountNumber} · ${account.accountLabel}${account.active ? '' : ' (inactive)'}` : 'Not configured'
}
