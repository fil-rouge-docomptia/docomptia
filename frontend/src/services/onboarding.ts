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

export async function getReferenceData(signal?: AbortSignal): Promise<ReferenceData> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/reference-data`, { signal })

  return (await response.json()) as ReferenceData
}

export async function getChartOfAccounts(): Promise<ChartOfAccount[]> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/chart-of-accounts?page=0&size=100`,
  )
  const page = (await response.json()) as PageResponse<ChartOfAccount>

  return page.content
}

export async function getAccountingRules(signal?: AbortSignal): Promise<AccountingRule[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/accounting-rules`, { signal })

  return (await response.json()) as AccountingRule[]
}

export async function updateAccountingRule(
  accountingRuleId: number,
  update: AccountingRuleUpdate,
  signal?: AbortSignal,
): Promise<AccountingRule> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/accounting-rules/${accountingRuleId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
      signal,
    },
  )

  return (await response.json()) as AccountingRule
}

async function readValidationPreferences(response: Response): Promise<ValidationPreferences> {
  const data = await response.json()
  const threshold: unknown = data?.validationThreshold ?? null
  if (!data || typeof data.validationRequired !== 'boolean' || (threshold !== null && (
    typeof threshold !== 'number' || !Number.isFinite(threshold) || threshold <= 0 ||
    threshold > 9999999999.99 || Math.round(threshold * 100) / 100 !== threshold || !data.validationRequired
  ))) throw new Error('Invalid validation preferences')
  return { validationRequired: data.validationRequired, validationThreshold: threshold as number | null }
}

export async function getValidationPreferences(signal?: AbortSignal): Promise<ValidationPreferences> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/organizations/current/validation-preferences`,
    { signal },
  )

  return readValidationPreferences(response)
}

export async function updateValidationPreferences(
  update: ValidationPreferencesUpdate,
  signal?: AbortSignal,
): Promise<ValidationPreferences> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/organizations/current/validation-preferences`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
      signal,
    },
  )

  return readValidationPreferences(response)
}

export async function getRoles(signal?: AbortSignal): Promise<ReferenceItem[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/roles`, { signal })

  return (await response.json()) as ReferenceItem[]
}

export async function inviteUser(invitation: UserInvitation, signal?: AbortSignal): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(invitation),
    signal,
  })

  return (await response.json()) as OrganizationUser
}

export async function getOrganizationUsers(): Promise<OrganizationUser[]> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users?page=0&size=100`)
  const page = (await response.json()) as PageResponse<OrganizationUser>

  return page.content
}

export function isRoleCode(code: string): code is RoleCode {
  return ['ADMIN', 'OPERATEUR_COMPTABLE', 'RESPONSABLE_COMPTABLE'].includes(code)
}
