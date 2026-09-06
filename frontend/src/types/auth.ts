export type LoginCredentials = {
  email: string
  password: string
}

export type SystemRoleCode =
  | 'OWNER'
  | 'ADMIN'
  | 'ACCOUNTING_MANAGER'
  | 'ACCOUNTANT'
  | 'APPROVER'
  | 'VIEWER'

export type RoleCode = string

export type PermissionCode =
  | 'user.profile.read'
  | 'reference-data.read'
  | 'organization.read'
  | 'organization.manage'
  | 'dashboard.read'
  | 'invoice.read'
  | 'invoice.upload'
  | 'invoice.correct'
  | 'invoice.submit-for-validation'
  | 'invoice.retry-ocr'
  | 'invoice.review-duplicate'
  | 'invoice.assign'
  | 'invoice.classify'
  | 'invoice.approve'
  | 'invoice.accounting.generate'
  | 'accounting-entry.update'
  | 'supplier.read'
  | 'supplier.manage'
  | 'accounting-configuration.read'
  | 'accounting-configuration.manage'
  | 'classification.read'
  | 'classification.manage'
  | 'member.read'
  | 'member.invite'
  | 'member.update'
  | 'member.status.update'
  | 'member.role.update'
  | 'member.owner.manage'
  | 'role.read'

export type LoginResponse = {
  userId: number
  email: string
  firstName: string
  lastName: string
  role: RoleCode
  roles: CurrentUserRole[]
  permissions: PermissionCode[]
  organizationId: number
  token: string
}

export type RegistrationDetails = {
  organizationName: string
  legalName: string
  siret: string
  firstName: string
  lastName: string
  email: string
  password: string
}

export type RegistrationResponse = {
  organizationId: number
  userId: number
  email: string
  role: RoleCode
  roles: CurrentUserRole[]
  permissions: PermissionCode[]
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
  roles: CurrentUserRole[]
  permissions: PermissionCode[]
  organization: CurrentUserOrganization
}
