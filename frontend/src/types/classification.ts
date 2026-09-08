export type ClassificationType = 'DOSSIER' | 'CLASSEUR' | 'CHANTIER'

export type Classification = {
  active: boolean
  classificationId: number
  createdAt: string
  description: string | null
  name: string
  type: string
  updatedAt: string
}

export type ClassificationPage = {
  content: Classification[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type ClassificationListQuery = {
  page: number
  size: number
  type?: ClassificationType
}

export type ClassificationInput = {
  type: ClassificationType
  name: string
  description: string
}
