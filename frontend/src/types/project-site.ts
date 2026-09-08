import type { Classification, ClassificationPage } from '@/types/classification'

export type ProjectSite = Classification

export type ProjectSitePage = ClassificationPage

export type ProjectSiteListQuery = {
  page: number
  size: number
}

export type ProjectSiteInput = {
  description: string
  name: string
}
