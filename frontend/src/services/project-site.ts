import { apiBaseUrl } from '@/lib/env'
import { authenticatedFetch } from '@/services/api'
import type {
  ProjectSite,
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
