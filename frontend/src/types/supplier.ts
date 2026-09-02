export type SupplierLegalIdentifier = {
  supplierLegalIdentifierId: number
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
