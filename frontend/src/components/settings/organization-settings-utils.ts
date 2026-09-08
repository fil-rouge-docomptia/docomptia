import { ApiError } from '@/services/api'
import type { Organization, OrganizationUpdate } from '@/types/organization'

export const organizationFields = [
  { key: 'name', label: 'Organization name', hint: 'Workspace display name.', required: true, type: 'text', autoComplete: 'organization' },
  { key: 'legalName', label: 'Legal name', hint: 'Registered company name.', required: true, type: 'text', autoComplete: 'off' },
  { key: 'siret', label: 'SIRET', hint: '14-digit French registration number.', required: true, type: 'text', autoComplete: 'off' },
  { key: 'email', label: 'Contact email', hint: 'Email address for your organization.', required: true, type: 'email', autoComplete: 'email' },
  { key: 'address', label: 'Address', hint: 'Primary legal address (optional).', required: false, type: 'text', autoComplete: 'street-address' },
  { key: 'phone', label: 'Phone', hint: 'Contact phone number (optional).', required: false, type: 'tel', autoComplete: 'tel' },
] as const

export type OrganizationValues = Record<keyof OrganizationUpdate, string>
export type OrganizationErrors = Partial<Record<keyof OrganizationValues | 'form', string>>

export function organizationValues(organization: Organization): OrganizationValues {
  return {
    name: organization.name,
    legalName: organization.legalName,
    siret: organization.siret.replace(/^(\d{3})(\d{3})(\d{3})(\d{5})$/, '$1 $2 $3 $4'),
    email: organization.email,
    address: organization.address ?? '',
    phone: organization.phone ?? '',
    defaultCurrencyCode: organization.defaultCurrencyCode ?? '',
  }
}

export function organizationChanges(organization: Organization, values: OrganizationValues): OrganizationUpdate {
  const normalized = {
    ...values,
    siret: values.siret.replace(/\s/g, ''),
    email: values.email.trim().toLowerCase(),
    defaultCurrencyCode: values.defaultCurrencyCode.trim().toUpperCase(),
  }
  const changes: OrganizationUpdate = {}
  for (const key of Object.keys(normalized) as Array<keyof OrganizationValues>) {
    if (normalized[key].trim() !== (organization[key] ?? '')) changes[key] = normalized[key].trim()
  }
  return changes
}

export function validateOrganizationChanges(changes: OrganizationUpdate): OrganizationErrors {
  const errors: OrganizationErrors = {}
  if (changes.name === '') errors.name = 'Enter the organization name.'
  if (changes.legalName === '') errors.legalName = 'Enter the legal name.'
  if (changes.siret !== undefined && !/^\d{14}$/.test(changes.siret)) errors.siret = 'Enter a valid 14-digit French SIRET.'
  if (changes.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email)) errors.email = 'Enter a valid contact email.'
  return errors
}

export function organizationSaveErrors(error: unknown): OrganizationErrors {
  if (error instanceof ApiError) {
    if (error.code === 'ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT') return { siret: 'Another organization already uses this SIRET.' }
    if (error.code === 'ORGANIZATION_VALIDATION_ERROR') {
      const key = [...organizationFields.map((field) => field.key), 'defaultCurrencyCode' as const]
        .find((key) => error.message.startsWith(`${key} `))
      if (key) return { [key]: key === 'siret' ? 'Enter a valid 14-digit French SIRET.' : error.message }
    }
    if (error.status === 403) return { form: 'You no longer have permission to update this organization. Reload settings to check your access.' }
    if ([404, 405, 501].includes(error.status)) return { form: 'Organization updates are currently unavailable. Your changes have not been confirmed.' }
  }
  return { form: 'Unable to confirm your changes. Reload settings to check the saved values before trying again.' }
}
