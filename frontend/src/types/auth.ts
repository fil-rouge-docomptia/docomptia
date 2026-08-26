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
