export type ProjectSite = {
  active: boolean
  classificationId: number
  createdAt: string
  description: string | null
  name: string
  type: string
  updatedAt: string
}

export type ProjectSitePage = {
  content: ProjectSite[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type ProjectSiteListQuery = {
  page: number
  size: number
}

export type ProjectSiteInput = {
  description: string
  name: string
}
