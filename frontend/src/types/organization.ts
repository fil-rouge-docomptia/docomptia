export type Organization = {
  organizationId: number
  name: string
  legalName: string
  siret: string
  email: string
  phone: string | null
  address: string | null
  defaultCurrencyCode: string | null
}

export type OrganizationUpdate = Partial<
  Pick<
    Organization,
    'name' | 'legalName' | 'siret' | 'email' | 'phone' | 'address' | 'defaultCurrencyCode'
  >
>

export type OnboardingStep = {
  code: string
  label: string
  action: string
}

export type OnboardingStatus = {
  progressPercentage: number
  completedStepCount: number
  totalStepCount: number
  completedSteps: OnboardingStep[]
  remainingActions: OnboardingStep[]
}
