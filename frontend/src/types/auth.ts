export type LoginCredentials = {
  email: string
  password: string
}

export type RoleCode = 'ADMIN' | 'OPERATEUR_COMPTABLE' | 'RESPONSABLE_COMPTABLE'

export type LoginResponse = {
  userId: number
  email: string
  firstName: string
  lastName: string
  role: RoleCode
  organizationId: number
  token: string
}

export type CurrentUserRole = {
  id: number
  code: RoleCode
  label: string
}

export type CurrentUserOrganization = {
  id: number
  name: string
  legalName: string
}

export type CurrentUser = {
  id: number
  firstName: string
  lastName: string
  email: string
  role: CurrentUserRole
  organization: CurrentUserOrganization
}
