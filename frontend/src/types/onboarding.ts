import type { CurrentUserRole, RoleCode } from '@/types/auth'

export type ReferenceItem = {
  code: string
  label: string
}

export type ReferenceData = {
  invoiceStatuses: ReferenceItem[]
  roles: ReferenceItem[]
  currencies: ReferenceItem[]
  invoiceFileFormats: ReferenceItem[]
}

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export type ChartOfAccount = {
  accountId: number
  accountNumber: string
  accountLabel: string
  accountType: string
  active: boolean
}

export type AccountingRuleAccount = {
  accountId: number
  accountNumber: string
  accountLabel: string
  active: boolean
}

export type AccountingRule = {
  accountingRuleId: number
  ruleName: string
  expenseAccount: AccountingRuleAccount | null
  vatAccount: AccountingRuleAccount | null
  supplierAccount: AccountingRuleAccount | null
  active: boolean
  configurationComplete: boolean
}

export type AccountingRuleUpdate = {
  expenseAccountId?: number
  vatAccountId?: number
  supplierAccountId?: number
}

export type ValidationPreferences = {
  validationRequired: boolean
  validationThreshold: number | null
}

export type ValidationPreferencesUpdate = {
  validationRequired: boolean
  validationThreshold?: number
}

export type UserInvitation = {
  firstName: string
  lastName: string
  email: string
  roleCode: RoleCode
}

export type OrganizationUser = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: CurrentUserRole
  active: boolean
}
