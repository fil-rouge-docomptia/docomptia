import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/services/api'
import { updateCurrentOrganization } from '@/services/organization'
import type { Organization, OrganizationUpdate } from '@/types/organization'

type OrganizationField = 'name' | 'legalName' | 'siret' | 'email' | 'phone' | 'address' | 'form'
type OrganizationErrors = Partial<Record<OrganizationField, string>>

type OrganizationFormValues = {
  name: string
  legalName: string
  siret: string
  email: string
  phone: string
  address: string
}

type OrganizationInformationFormProps = {
  organization: Organization
  onBack: () => void
  onComplete: () => void
}

function formatSiret(siret: string) {
  const digits = siret.replace(/\D/g, '').slice(0, 14)

  return [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9), digits.slice(9)]
    .filter(Boolean)
    .join(' ')
}

function isValidSiret(siret: string) {
  if (!/^\d{14}$/.test(siret) || /^0+$/.test(siret)) {
    return false
  }

  let sum = 0
  let shouldDouble = false

  for (let index = siret.length - 1; index >= 0; index -= 1) {
    let digit = Number(siret[index])

    if (shouldDouble) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    shouldDouble = !shouldDouble
  }

  return sum % 10 === 0
}

function getInitialValues(organization: Organization): OrganizationFormValues {
  return {
    name: organization.name,
    legalName: organization.legalName,
    siret: formatSiret(organization.siret),
    email: organization.email,
    phone: organization.phone ?? '',
    address: organization.address ?? '',
  }
}

function validate(values: OrganizationFormValues): OrganizationErrors {
  const errors: OrganizationErrors = {}
  const siret = values.siret.replace(/\D/g, '')

  if (!values.name.trim()) {
    errors.name = 'Enter the company name.'
  }
  if (!values.legalName.trim()) {
    errors.legalName = 'Enter the legal name.'
  }
  if (!isValidSiret(siret)) {
    errors.siret = 'Enter a valid 14-digit French SIRET.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Enter a valid contact email.'
  }
  if (!values.address.trim()) {
    errors.address = 'Enter the company address.'
  }

  return errors
}

function getApiErrors(error: unknown): OrganizationErrors {
  if (!(error instanceof ApiError)) {
    return { form: 'Unable to save the company information. Please try again.' }
  }

  if (error.code === 'ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT') {
    return { siret: 'Another organization already uses this SIRET.' }
  }

  if (error.code === 'ORGANIZATION_VALIDATION_ERROR') {
    const field = ['name', 'legalName', 'siret', 'email', 'phone', 'address'].find((candidate) =>
      error.message.startsWith(candidate),
    ) as OrganizationField | undefined

    if (field) {
      return { [field]: error.message }
    }
  }

  if (error.status === 403) {
    return { form: 'Only an organization administrator can update this information.' }
  }

  return { form: error.message }
}

function getChangedValues(
  organization: Organization,
  values: OrganizationFormValues,
): OrganizationUpdate {
  const normalizedValues: OrganizationFormValues = {
    name: values.name.trim(),
    legalName: values.legalName.trim(),
    siret: values.siret.replace(/\D/g, ''),
    email: values.email.trim().toLowerCase(),
    phone: values.phone.trim(),
    address: values.address.trim(),
  }
  const currentValues = getInitialValues(organization)
  const update: OrganizationUpdate = {}

  for (const field of Object.keys(normalizedValues) as Array<keyof OrganizationFormValues>) {
    const currentValue = field === 'siret'
      ? currentValues[field].replace(/\D/g, '')
      : currentValues[field].trim()

    if (normalizedValues[field] !== currentValue) {
      update[field] = normalizedValues[field]
    }
  }

  return update
}

type FieldErrorProps = {
  id: string
  message?: string
}

function FieldError({ id, message }: FieldErrorProps) {
  return message ? (
    <p className="text-xs leading-4 text-destructive-text" id={id}>
      {message}
    </p>
  ) : null
}

export function OrganizationInformationForm({
  organization,
  onBack,
  onComplete,
}: OrganizationInformationFormProps) {
  const [values, setValues] = useState<OrganizationFormValues>(() => getInitialValues(organization))
  const [errors, setErrors] = useState<OrganizationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof OrganizationFormValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined, form: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors = validate(values)

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    const update = getChangedValues(organization, values)

    if (Object.keys(update).length === 0) {
      onComplete()
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      await updateCurrentOrganization(update)
      onComplete()
    } catch (error) {
      setErrors(getApiErrors(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-8">
        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organization-name">
            Company name
          </Label>
          <Input
            aria-describedby={errors.name ? 'organization-name-error' : undefined}
            aria-invalid={Boolean(errors.name)}
            autoComplete="organization"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organization-name"
            onChange={(event) => updateField('name', event.target.value)}
            required
            value={values.name}
          />
          <FieldError id="organization-name-error" message={errors.name} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organization-legal-name">
            Legal name
          </Label>
          <Input
            aria-describedby={errors.legalName ? 'organization-legal-name-error' : undefined}
            aria-invalid={Boolean(errors.legalName)}
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organization-legal-name"
            onChange={(event) => updateField('legalName', event.target.value)}
            required
            value={values.legalName}
          />
          <FieldError id="organization-legal-name-error" message={errors.legalName} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organization-email">
            Contact email
          </Label>
          <Input
            aria-describedby={errors.email ? 'organization-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organization-email"
            onChange={(event) => updateField('email', event.target.value)}
            required
            type="email"
            value={values.email}
          />
          <FieldError id="organization-email-error" message={errors.email} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organization-phone">
            Phone <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            aria-describedby={errors.phone ? 'organization-phone-error' : undefined}
            aria-invalid={Boolean(errors.phone)}
            autoComplete="tel"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organization-phone"
            onChange={(event) => updateField('phone', event.target.value)}
            type="tel"
            value={values.phone}
          />
          <FieldError id="organization-phone-error" message={errors.phone} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organization-siret">
            SIRET
          </Label>
          <Input
            aria-describedby={errors.siret ? 'organization-siret-error' : 'organization-siret-help'}
            aria-invalid={Boolean(errors.siret)}
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organization-siret"
            inputMode="numeric"
            maxLength={17}
            onChange={(event) => updateField('siret', formatSiret(event.target.value))}
            required
            value={values.siret}
          />
          {errors.siret ? (
            <FieldError id="organization-siret-error" message={errors.siret} />
          ) : (
            <p className="text-xs leading-4 text-muted-foreground" id="organization-siret-help">
              14 digits
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organization-address">
            Company address
          </Label>
          <Input
            aria-describedby={errors.address ? 'organization-address-error' : undefined}
            aria-invalid={Boolean(errors.address)}
            autoComplete="street-address"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organization-address"
            onChange={(event) => updateField('address', event.target.value)}
            required
            value={values.address}
          />
          <FieldError id="organization-address-error" message={errors.address} />
        </div>
      </div>

      {errors.form ? (
        <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
          <CircleAlert aria-hidden="true" className="size-4" />
          <AlertDescription>{errors.form}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Button disabled={isSubmitting} onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Saving…
            </>
          ) : (
            'Continue'
          )}
        </Button>
      </div>
    </form>
  )
}
