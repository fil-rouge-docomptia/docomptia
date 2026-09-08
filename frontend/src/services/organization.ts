import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type {
  OnboardingStatus,
  Organization,
  OrganizationUpdate,
} from '@/types/organization'

export async function getCurrentOrganization(signal?: AbortSignal): Promise<Organization> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/organizations/current`, { signal })

  return (await response.json()) as Organization
}

export async function updateCurrentOrganization(
  update: OrganizationUpdate,
  signal?: AbortSignal,
): Promise<Organization> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/organizations/current`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(update),
    signal,
  })

  return (await response.json()) as Organization
}

export async function getOrganizationOnboardingStatus(): Promise<OnboardingStatus> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/organizations/current/onboarding`,
  )

  return (await response.json()) as OnboardingStatus
}
