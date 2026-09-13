export type SupplierLegalIdentifier = {
  identifierId: number
  type: string
  scheme: string
  countryCode: string
  value: string
  normalizedValue: string
  validFrom: string | null
  validTo: string | null
  source: string
  verified: boolean
  changeReason: string | null
  createdByUserId: number | null
  createdAt: string
  updatedAt: string
}

export type SupplierDetails = SupplierListItem & {
  email: string | null
  phone: string | null
  address: string | null
  createdAt: string
  updatedAt: string
  legalIdentifierHistory: SupplierLegalIdentifier[]
}

export type SupplierUpdate = {
  address?: string
  email?: string
  legalName?: string
  name?: string
  phone?: string
}

export type SupplierCreate = SupplierUpdate & {
  siret?: string
  vatNumber?: string
}

export type SupplierLegalIdentifierReplacement = {
  countryCode: string
  reason: string
  scheme: string
  type: string
  validFrom?: string
  value: string
}

export type SupplierListItem = {
  supplierId: number
  name: string
  legalName: string
  siret: string | null
  vatNumber: string | null
  tradeName: string | null
  countryCode: string | null
  currentLegalIdentifiers: SupplierLegalIdentifier[]
}

export type SupplierPage = {
  content: SupplierListItem[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export type SupplierListQuery = {
  page: number
  query?: string
  size: number
}
