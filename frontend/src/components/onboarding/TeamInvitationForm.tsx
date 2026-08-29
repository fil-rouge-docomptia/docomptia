import { useState } from 'react'
import type { FormEvent } from 'react'
import { CircleAlert, LoaderCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ApiError } from '@/services/api'
import { inviteUser, isRoleCode } from '@/services/onboarding'
import type { RoleCode } from '@/types/auth'
import type { OrganizationUser, ReferenceItem } from '@/types/onboarding'

type TeamInvitationFormProps = {
  initialInvitations: OrganizationUser[]
  onBack: () => void
  onComplete: () => void
  roles: ReferenceItem[]
}

type InvitationField = 'email' | 'firstName' | 'lastName' | 'roleCode' | 'form'
type InvitationErrors = Partial<Record<InvitationField, string>>

type InvitationValues = {
  email: string
  firstName: string
  lastName: string
  roleCode: RoleCode
}

function getInitialRole(roles: ReferenceItem[]): RoleCode {
  const preferredRole = roles.find((role) => role.code === 'OPERATEUR_COMPTABLE')
  const fallbackRole = preferredRole ?? roles.find((role) => isRoleCode(role.code))

  return fallbackRole && isRoleCode(fallbackRole.code) ? fallbackRole.code : 'OPERATEUR_COMPTABLE'
}

function getApiErrors(error: unknown): InvitationErrors {
  if (!(error instanceof ApiError)) {
    return { form: 'Unable to create the invitation. Please try again.' }
  }

  if (error.code === 'USER_EMAIL_CONFLICT') {
    return { email: 'A user already uses this email address.' }
  }

  if (error.code === 'USER_VALIDATION_ERROR') {
    const field = ['firstName', 'lastName', 'email', 'roleCode'].find((candidate) =>
      error.message.startsWith(candidate),
    ) as InvitationField | undefined

    if (field) {
      return { [field]: error.message }
    }
  }

  if (error.status === 403) {
    return { form: 'Only an organization administrator can invite teammates.' }
  }

  return { form: error.message }
}

function getInitials(user: OrganizationUser) {
  return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
}

export function TeamInvitationForm({
  initialInvitations,
  onBack,
  onComplete,
  roles,
}: TeamInvitationFormProps) {
  const initialRole = getInitialRole(roles)
  const [values, setValues] = useState<InvitationValues>({
    email: '',
    firstName: '',
    lastName: '',
    roleCode: initialRole,
  })
  const [errors, setErrors] = useState<InvitationErrors>({})
  const [invitations, setInvitations] = useState(initialInvitations)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof InvitationValues, value: string) {
    setValues((currentValues) => ({ ...currentValues, [field]: value }))
    setErrors((currentErrors) => ({ ...currentErrors, [field]: undefined, form: undefined }))
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationErrors: InvitationErrors = {}

    if (!values.firstName.trim()) {
      validationErrors.firstName = 'Enter a first name.'
    }
    if (!values.lastName.trim()) {
      validationErrors.lastName = 'Enter a last name.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      validationErrors.email = 'Enter a valid work email.'
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    setErrors({})
    setIsSubmitting(true)

    try {
      const invitation = await inviteUser({
        email: values.email.trim().toLowerCase(),
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        roleCode: values.roleCode,
      })
      setInvitations((currentInvitations) => [...currentInvitations, invitation])
      setValues({ email: '', firstName: '', lastName: '', roleCode: initialRole })
    } catch (error) {
      setErrors(getApiErrors(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-5 text-muted-foreground">
        Invite colleagues now or continue and add them later from Settings.
      </p>

      <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleInvite}>
        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="invite-first-name">
            First name
          </Label>
          <Input
            aria-describedby={errors.firstName ? 'invite-first-name-error' : undefined}
            aria-invalid={Boolean(errors.firstName)}
            autoComplete="given-name"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="invite-first-name"
            onChange={(event) => updateField('firstName', event.target.value)}
            value={values.firstName}
          />
          {errors.firstName ? (
            <p className="text-xs text-destructive-text" id="invite-first-name-error">
              {errors.firstName}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="invite-last-name">
            Last name
          </Label>
          <Input
            aria-describedby={errors.lastName ? 'invite-last-name-error' : undefined}
            aria-invalid={Boolean(errors.lastName)}
            autoComplete="family-name"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="invite-last-name"
            onChange={(event) => updateField('lastName', event.target.value)}
            value={values.lastName}
          />
          {errors.lastName ? (
            <p className="text-xs text-destructive-text" id="invite-last-name-error">
              {errors.lastName}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="invite-email">
            Email
          </Label>
          <Input
            aria-describedby={errors.email ? 'invite-email-error' : undefined}
            aria-invalid={Boolean(errors.email)}
            autoComplete="email"
            className="h-11 md:h-9"
            disabled={isSubmitting}
            id="invite-email"
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="colleague@company.com"
            type="email"
            value={values.email}
          />
          {errors.email ? (
            <p className="text-xs text-destructive-text" id="invite-email-error">
              {errors.email}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs leading-4 tracking-[0.1px]" htmlFor="invite-role">
            Role
          </Label>
          <Select
            disabled={isSubmitting}
            onValueChange={(value) => {
              if (isRoleCode(value)) {
                updateField('roleCode', value)
              }
            }}
            value={values.roleCode}
          >
            <SelectTrigger className="h-11 md:h-9" id="invite-role">
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              {roles.filter((role) => isRoleCode(role.code)).map((role) => (
                <SelectItem key={role.code} value={role.code}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.roleCode ? (
            <p className="text-xs text-destructive-text">{errors.roleCode}</p>
          ) : null}
        </div>

        {errors.form ? (
          <Alert className="border-destructive/30 bg-destructive/5 md:col-span-2" variant="destructive">
            <CircleAlert aria-hidden="true" className="size-4" />
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex justify-end md:col-span-2">
          <Button disabled={isSubmitting} type="submit" variant="outline">
            {isSubmitting ? (
              <>
                <LoaderCircle aria-hidden="true" className="animate-spin" />
                Adding…
              </>
            ) : (
              'Add teammate'
            )}
          </Button>
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-[0.1px]">Roles</span>
        {roles.map((role) => (
          <Badge className="font-medium" key={role.code} variant="outline">
            {role.label}
          </Badge>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        {invitations.length > 0 ? (
          <ul className="divide-y">
            {invitations.map((invitation) => (
              <li className="flex min-h-14 items-center gap-3 px-4 py-2" key={invitation.id}>
                <Avatar className="size-7">
                  <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                    {getInitials(invitation)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium leading-5">{invitation.email}</p>
                  <p className="text-xs leading-4 text-muted-foreground">
                    Invitation created · activation pending
                  </p>
                </div>
                <Badge className="font-medium" variant="secondary">
                  {invitation.role.label}
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-5 text-center text-sm text-muted-foreground">
            No pending invitations. You can continue without inviting anyone.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button disabled={isSubmitting} onClick={onBack} type="button" variant="outline">
          Back
        </Button>
        <Button disabled={isSubmitting} onClick={onComplete} type="button">
          Continue
        </Button>
      </div>
    </div>
  )
}
