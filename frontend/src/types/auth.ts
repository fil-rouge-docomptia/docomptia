export type LoginCredentials = {
  email: string
  password: string
}

export type LoginResponse = {
  userId: number
  email: string
  firstName: string
  lastName: string
  role: string
  organizationId: number
  token: string
}

export type CurrentUserRole = {
  id: number
  code: string
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
