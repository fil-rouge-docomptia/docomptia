import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type {
  ProjectSite,
  ProjectSiteInput,
  ProjectSiteListQuery,
  ProjectSitePage,
} from '@/types/project-site'

export async function listProjectSites(
  query: ProjectSiteListQuery,
  signal?: AbortSignal,
): Promise<ProjectSitePage> {
  const searchParams = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
    type: 'CHANTIER',
  })
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/classifications?${searchParams.toString()}`,
    { signal },
  )

  return response.json() as Promise<ProjectSitePage>
}

export async function getProjectSite(
  projectSiteId: number,
  signal?: AbortSignal,
): Promise<ProjectSite> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/classifications/${projectSiteId}`,
    { signal },
  )

  return response.json() as Promise<ProjectSite>
}

export async function createProjectSite(input: ProjectSiteInput): Promise<ProjectSite> {
  const response = await authenticatedFetch(`${apiBaseUrl}/v1/classifications`, {
    body: JSON.stringify({ ...input, type: 'CHANTIER' }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  })

  return response.json() as Promise<ProjectSite>
}

export async function updateProjectSite(
  projectSiteId: number,
  input: ProjectSiteInput,
): Promise<ProjectSite> {
  const response = await authenticatedFetch(
    `${apiBaseUrl}/v1/classifications/${projectSiteId}`,
    {
      body: JSON.stringify(input),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    },
  )

  return response.json() as Promise<ProjectSite>
}
