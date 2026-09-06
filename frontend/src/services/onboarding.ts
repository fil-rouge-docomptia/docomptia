import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { RoleCode } from '@/types/auth'
import type {
  AccountingRule,
  AccountingRuleUpdate,
  ChartOfAccount,
  OrganizationUser,
  PageResponse,
  ReferenceData,
  ReferenceItem,
  UserInvitation,
  ValidationPreferences,
  ValidationPreferencesUpdate,
} from '@/types/onboarding'

export async function getReferenceData(): Promise<ReferenceData> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/reference-data`)

  return (await response.json()) as ReferenceData
}

export async function getChartOfAccounts(): Promise<ChartOfAccount[]> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/chart-of-accounts?page=0&size=100`,
  )
  const page = (await response.json()) as PageResponse<ChartOfAccount>

  return page.content
}

export async function getAccountingRules(): Promise<AccountingRule[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-rules`)

  return (await response.json()) as AccountingRule[]
}

export async function updateAccountingRule(
  accountingRuleId: number,
  update: AccountingRuleUpdate,
): Promise<AccountingRule> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/accounting-rules/${accountingRuleId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
    },
  )

  return (await response.json()) as AccountingRule
}

export async function getValidationPreferences(): Promise<ValidationPreferences> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/organizations/current/validation-preferences`,
  )

  return (await response.json()) as ValidationPreferences
}

export async function updateValidationPreferences(
  update: ValidationPreferencesUpdate,
): Promise<ValidationPreferences> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/organizations/current/validation-preferences`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
    },
  )

  return (await response.json()) as ValidationPreferences
}

export async function getRoles(): Promise<ReferenceItem[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/roles`)

  return (await response.json()) as ReferenceItem[]
}

export async function inviteUser(invitation: UserInvitation): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invitation),
  })

  return (await response.json()) as OrganizationUser
}

export async function getOrganizationUsers(): Promise<OrganizationUser[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users?page=0&size=100`)
  const page = (await response.json()) as PageResponse<OrganizationUser>

  return page.content
}

export function isRoleCode(code: string): code is RoleCode {
  return code.trim().length > 0
}
