import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthCardLayout } from '@/components/auth/AuthCardLayout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { setPendingRegistrationEmail } from '@/lib/registration-session'
import { ApiError } from '@/services/api'
import { register } from '@/services/auth'
import type { LoginCredentials, RegistrationDetails } from '@/types/auth'

type RegistrationField = 'fullName' | 'email' | 'siret' | 'terms' | 'form'
type RegistrationErrors = Partial<Record<RegistrationField, string>>

function getRegistrationIdentity(fullName: string) {
  const nameParts = fullName.trim().split(/\s+/)

  if (nameParts.length < 2) {
    return null
  }

  return {
    firstName: nameParts.slice(0, -1).join(' '),
    lastName: nameParts.at(-1) ?? '',
  }
}

function getApiErrors(error: unknown): RegistrationErrors {
  if (!(error instanceof ApiError)) {
    return { form: 'Unable to create your account. Please try again.' }
  }

  if (error.code === 'USER_EMAIL_CONFLICT') {
    return { email: 'An account already uses this email address.' }
  }

  if (error.code === 'ORGANIZATION_LEGAL_IDENTIFIER_CONFLICT') {
    return { siret: 'An organization already uses this SIRET.' }
  }

  return { form: error.message }
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const fullName = String(formData.get('fullName'))
    const identity = getRegistrationIdentity(fullName)
    const validationErrors: RegistrationErrors = {}

    if (!identity) {
      validationErrors.fullName = 'Enter your first and last name.'
    }

    if (!acceptedTerms) {
      validationErrors.terms = 'Accept the terms to create your account.'
    }

    if (Object.keys(validationErrors).length > 0 || !identity) {
      setErrors(validationErrors)
      return
    }

    const details: RegistrationDetails = {
      organizationName: String(formData.get('organizationName')).trim(),
      legalName: String(formData.get('legalName')).trim(),
      siret: String(formData.get('siret')).trim(),
      firstName: identity.firstName,
      lastName: identity.lastName,
      email: String(formData.get('email')).trim(),
      password: String(formData.get('password')),
    }
    const credentials: LoginCredentials = {
      email: details.email,
      password: details.password,
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const registration = await register(details)
      setPendingRegistrationEmail(registration.email)
      navigate('/verify-email', {
        state: {
          email: registration.email,
          credentials,
        },
      })
    } catch (error) {
      setErrors(getApiErrors(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCardLayout
      description="Set up your Docomptia profile to continue."
      title="Create your account"
    >
      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="fullName">
            Full name
          </Label>
          <Input
            aria-describedby={errors.fullName ? 'full-name-error' : undefined}
            aria-invalid={Boolean(errors.fullName)}
            autoComplete="name"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="fullName"
            name="fullName"
            placeholder="Alex Morgan"
            required
          />
          {errors.fullName ? (
            <p className="text-xs text-destructive-text" id="full-name-error">
              {errors.fullName}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="email">
            Work email
          </Label>
          <Input
            aria-describedby={errors.email ? 'registration-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="email"
            name="email"
            placeholder="name@company.com"
            required
            type="email"
          />
          {errors.email ? (
            <p className="text-xs text-destructive-text" id="registration-email-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="password">
            Password
          </Label>
          <Input
            autoComplete="new-password"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="password"
            name="password"
            required
            type="password"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="organizationName">
            Organization name
          </Label>
          <Input
            autoComplete="organization"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="organizationName"
            name="organizationName"
            placeholder="Company name"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="legalName">
            Legal name
          </Label>
          <Input
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="legalName"
            name="legalName"
            placeholder="Company legal name"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="siret">
            SIRET
          </Label>
          <Input
            aria-describedby={errors.siret ? 'registration-siret-error' : 'registration-siret-help'}
            aria-invalid={Boolean(errors.siret)}
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="siret"
            inputMode="numeric"
            maxLength={14}
            minLength={14}
            name="siret"
            pattern="[0-9]{14}"
            placeholder="12345678901234"
            required
          />
          <p
            className={errors.siret ? 'text-xs text-destructive-text' : 'text-xs text-muted-foreground'}
            id={errors.siret ? 'registration-siret-error' : 'registration-siret-help'}
          >
            {errors.siret ?? '14 digits'}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Checkbox
              aria-describedby={errors.terms ? 'registration-terms-error' : undefined}
              aria-invalid={Boolean(errors.terms)}
              checked={acceptedTerms}
              disabled={isSubmitting}
              id="terms"
              onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
            />
            <Label className="text-xs font-normal leading-4 text-muted-foreground" htmlFor="terms">
              I agree to the <span className="font-medium text-foreground">Terms of Service</span>{' '}
              and <span className="font-medium text-foreground">Privacy Policy</span>.
            </Label>
          </div>
          {errors.terms ? (
            <p className="text-xs text-destructive-text" id="registration-terms-error">
              {errors.terms}
            </p>
          ) : null}
        </div>

        {errors.form ? (
          <Alert className="border-destructive/30 bg-destructive/5" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        ) : null}

        <Button className="h-11 md:h-10" disabled={isSubmitting} type="submit">
          {isSubmitting ? (
            <>
              <LoaderCircle aria-hidden="true" className="animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>

        <p className="text-center text-xs leading-4 text-muted-foreground">
          Already have an account?{' '}
          <Link className="font-medium text-primary underline-offset-4 hover:underline" to="/login">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCardLayout>
  )
}
