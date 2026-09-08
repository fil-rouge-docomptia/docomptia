import { createClassification, getClassification, listClassifications, updateClassification } from '@/services/classification'
import type { ProjectSite, ProjectSiteInput, ProjectSiteListQuery, ProjectSitePage } from '@/types/project-site'

export function listProjectSites(query: ProjectSiteListQuery, signal?: AbortSignal): Promise<ProjectSitePage> {
  return listClassifications({ ...query, type: 'CHANTIER' }, signal)
}

export function getProjectSite(projectSiteId: number, signal?: AbortSignal): Promise<ProjectSite> {
  return getClassification(projectSiteId, signal)
}

export function createProjectSite(input: ProjectSiteInput): Promise<ProjectSite> {
  return createClassification({ ...input, type: 'CHANTIER' })
}

export function updateProjectSite(projectSiteId: number, input: ProjectSiteInput): Promise<ProjectSite> {
  return updateClassification(projectSiteId, input)
}
