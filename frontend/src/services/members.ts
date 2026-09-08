import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type { RoleCode } from '@/types/auth'
import type { OrganizationUser, PageResponse } from '@/types/onboarding'

export type MemberIdentity = Pick<OrganizationUser, 'firstName' | 'lastName' | 'email'>

export async function getOrganizationMembers(signal?: AbortSignal): Promise<OrganizationUser[]> {
  const members: OrganizationUser[] = []
  let totalPages = 1
  let totalElements = 0
  // The API has no search/status filters. Load every page before filtering the team locally.
  for (let number = 0; number < totalPages; number++) {
    const response = await authenticatedFetch(`${apiBaseUrl}/v1/users?page=${number}&size=100&sortBy=lastName&direction=ASC`, { signal })
    const page = (await response.json()) as PageResponse<OrganizationUser>
    if (!Array.isArray(page.content) || page.number !== number || !Number.isSafeInteger(page.totalPages) || page.totalPages < 0) {
      throw new Error('Invalid member list')
    }
    if (number > 0 && (page.totalPages !== totalPages || page.totalElements !== totalElements)) {
      throw new Error('The member list changed while loading. Reload the list.')
    }
    totalPages = page.totalPages
    totalElements = page.totalElements
    members.push(...page.content)
  }
  if (members.length !== totalElements || new Set(members.map(({ id }) => id)).size !== totalElements) {
    throw new Error('Incomplete member list. Reload the list.')
  }
  return members
}

export async function updateMember(id: number, update: Partial<MemberIdentity>, signal?: AbortSignal): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update), signal,
  })
  return (await response.json()) as OrganizationUser
}

export async function updateMemberRole(id: number, roleCode: RoleCode, signal?: AbortSignal): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users/${id}/role`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleCode }), signal,
  })
  return (await response.json()) as OrganizationUser
}

export async function updateMemberStatus(id: number, active: boolean, signal?: AbortSignal): Promise<OrganizationUser> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/users/${id}/status`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }), signal,
  })
  return (await response.json()) as OrganizationUser
}
