export type Customer = {
  customerId: number
  name: string
  legalName: string
  siret: string | null
  vatNumber: string | null
  email: string | null
  phone: string | null
  address: string | null
  active: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type CustomerPage = {
  content: Customer[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}
