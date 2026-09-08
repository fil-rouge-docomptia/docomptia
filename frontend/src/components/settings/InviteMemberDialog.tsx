import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle, Plus } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/services/api'
import { getRoles, inviteUser, isRoleCode } from '@/services/onboarding'
import type { OrganizationUser, ReferenceItem } from '@/types/onboarding'

type InvitationField = 'email' | 'firstName' | 'lastName' | 'roleCode'
type InvitationErrors = Partial<Record<InvitationField | 'form', string>>
const fields = [
  { key: 'email', label: 'Email', autoComplete: 'email' },
  { key: 'firstName', label: 'First name', autoComplete: 'given-name' },
  { key: 'lastName', label: 'Last name', autoComplete: 'family-name' },
] as const

function invitationErrors(error: unknown): InvitationErrors {
  if (error instanceof ApiError) {
    if (error.code === 'USER_EMAIL_CONFLICT') return { email: 'A user already uses this email address.' }
    if (error.code === 'USER_VALIDATION_ERROR') {
      if (error.message.startsWith('email')) return { email: 'Enter a valid email address.' }
      if (error.message.startsWith('firstName')) return { firstName: 'Enter a first name.' }
      if (error.message.startsWith('lastName')) return { lastName: 'Enter a last name.' }
      if (error.message.startsWith('roleCode')) return { roleCode: 'Select a role available for this organization.' }
    }
    if (error.status === 403) return { form: 'Only an organization administrator can invite members. Close this dialog and reload the members.' }
    if ([404, 405, 501].includes(error.status)) return { form: 'Invitations are currently unavailable. Please try again later.' }
    if (error.status === 400) return { form: 'The invitation was rejected. Check the information and selected role.' }
    if (error.status === 409) return { form: 'The invitation conflicts with an existing member. Check the member list before trying again.' }
  }
  return { form: 'Unable to confirm the invitation. Close this dialog and reload members before retrying. Your entries are kept here.' }
}

type InviteMemberDialogProps = {
  onClose: () => void
  onCreated: (member: OrganizationUser) => void
  onRestoreFocus: () => void
}

export function InviteMemberDialog({ onClose, onCreated, onRestoreFocus }: InviteMemberDialogProps) {
  const id = useId()
  const [values, setValues] = useState({ email: '', firstName: '', lastName: '', roleCode: '' })
  const [errors, setErrors] = useState<InvitationErrors>({})
  const [apiError, setApiError] = useState<unknown>(null)
  const [roles, setRoles] = useState<ReferenceItem[] | null>(null)
  const [rolesError, setRolesError] = useState<unknown>(null)
  const [rolesRetry, setRolesRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const request = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const errorAlert = useRef<HTMLDivElement>(null)
  const shouldFocusError = useRef(false)
  const unavailable = apiError instanceof ApiError && [403, 404, 405, 501].includes(apiError.status)
  const rolesDenied = rolesError instanceof ApiError && rolesError.status === 403

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    getRoles(controller.signal)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid role list')
        if (!controller.signal.aborted) setRoles(data.filter(({ code }) => isRoleCode(code)))
      })
      .catch((error: unknown) => { if (!controller.signal.aborted) setRolesError(error) })
    return () => controller.abort()
  }, [rolesRetry])
  useEffect(() => {
    if (saving || !shouldFocusError.current) return
    shouldFocusError.current = false
    const field = (['email', 'firstName', 'lastName', 'roleCode'] as const).find((key) => errors[key])
    if (field) form.current?.querySelector<HTMLElement>(`[id="${id}-${field}"]`)?.focus()
    else if (errors.form) errorAlert.current?.focus()
  }, [errors, id, saving])

  function updateField(field: InvitationField, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, form: unavailable ? current.form : undefined }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current || unavailable || !roles?.length || rolesError) return
    const validation: InvitationErrors = {}
    const email = values.email.trim().toLowerCase()
    const firstName = values.firstName.trim()
    const lastName = values.lastName.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) validation.email = 'Enter a valid email address.'
    if (!firstName) validation.firstName = 'Enter a first name.'
    if (!lastName) validation.lastName = 'Enter a last name.'
    if (!roles.some(({ code }) => code === values.roleCode) || !isRoleCode(values.roleCode)) validation.roleCode = 'Select an initial role.'
    setErrors(validation)
    if (Object.keys(validation).length || !isRoleCode(values.roleCode)) {
      shouldFocusError.current = true
      return
    }

    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setApiError(null)
    try {
      const created = await inviteUser({ email, firstName, lastName, roleCode: values.roleCode }, controller.signal)
      if (!created || !Number.isSafeInteger(created.id) || created.id <= 0 || created.email !== email ||
        typeof created.firstName !== 'string' || typeof created.lastName !== 'string' ||
        typeof created.active !== 'boolean' || !created.role || !isRoleCode(created.role.code)) {
        throw new Error('Invalid invitation response')
      }
      if (!controller.signal.aborted) onCreated(created)
    } catch (error) {
      if (!controller.signal.aborted) { shouldFocusError.current = true; setApiError(error); setErrors(invitationErrors(error)) }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <DialogContent
        className="max-h-[90dvh] w-[calc(100%-3rem)] overflow-y-auto rounded-lg p-6 sm:max-w-[560px] [&>button]:right-2 [&>button]:top-2 [&>button]:size-11"
        onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }}
        onOpenAutoFocus={(event) => { event.preventDefault(); form.current?.querySelector<HTMLInputElement>('input')?.focus() }}
      >
        <form aria-busy={saving} aria-label="Invite member" className="space-y-6" noValidate onSubmit={(event) => void submit(event)} ref={form}>
          <DialogHeader className="space-y-3 text-left">
            <DialogTitle className="pr-8 text-xl tracking-[-0.25px]">Invite member</DialogTitle>
            <DialogDescription className="text-xs">Invite a teammate and assign their initial role.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map(({ key, label, autoComplete }) => (
              <div className={`min-w-0 space-y-1.5 ${key === 'email' ? 'sm:col-span-2' : ''}`} key={key}>
                <Label className="text-xs tracking-[0.1px]" htmlFor={`${id}-${key}`}>{label}</Label>
                <Input
                  aria-describedby={errors[key] ? `${id}-${key}-error` : undefined}
                  aria-invalid={Boolean(errors[key])}
                  autoComplete={autoComplete}
                  className="h-11 sm:h-9"
                  disabled={saving}
                  id={`${id}-${key}`}
                  onChange={(event) => updateField(key, event.target.value)}
                  placeholder={key === 'email' ? 'name@company.com' : undefined}
                  required
                  type={key === 'email' ? 'email' : 'text'}
                  value={values[key]}
                />
                {errors[key] ? <p className="text-xs text-destructive" id={`${id}-${key}-error`}>{errors[key]}</p> : null}
              </div>
            ))}
            <div className="min-w-0 space-y-1.5 sm:col-span-2">
              <Label className="text-xs tracking-[0.1px]" htmlFor={`${id}-roleCode`}>Role</Label>
              <Select disabled={saving || !roles?.length || Boolean(rolesError)} onValueChange={(value) => { if (isRoleCode(value)) updateField('roleCode', value) }} value={values.roleCode}>
                <SelectTrigger aria-describedby={`${id}-role-help${errors.roleCode ? ` ${id}-roleCode-error` : ''}`} aria-invalid={Boolean(errors.roleCode)} aria-required="true" className="h-11 sm:h-9" id={`${id}-roleCode`}><SelectValue placeholder="Select a role" /></SelectTrigger>
                <SelectContent>{roles?.map(({ code, label }) => <SelectItem className="min-h-11 sm:min-h-9" key={code} value={code}>{label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground" id={`${id}-role-help`}>Choose the member’s initial permissions.</p>
              {errors.roleCode ? <p className="text-xs text-destructive" id={`${id}-roleCode-error`}>{errors.roleCode}</p> : null}
              {rolesError ? (
                <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription className="space-y-3">
                  <p>{rolesDenied ? 'Only administrators can load roles and invite members.' : 'Unable to load available roles.'}</p>
                  <Button onClick={() => { setRolesError(null); setRoles(null); setRolesRetry((value) => value + 1) }} type="button" variant="outline">Retry roles</Button>
                </AlertDescription></Alert>
              ) : roles === null ? <p aria-busy="true" className="text-xs text-muted-foreground" role="status">Loading roles…</p>
                : !roles.length ? <p className="text-xs text-muted-foreground" role="status">No roles are available for invitation. Contact an administrator.</p> : null}
            </div>
          </div>
          <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">The member will be added as inactive. No invitation email will be sent.</p>
          {errors.form ? <Alert ref={errorAlert} tabIndex={-1} variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{errors.form}</AlertDescription></Alert> : null}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:space-x-0">
            <Button className="h-11 sm:h-10" disabled={saving} onClick={onClose} type="button" variant="secondary">Cancel</Button>
            <Button className="h-11 sm:h-10" disabled={saving || unavailable || !roles?.length || Boolean(rolesError)} type="submit">{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Plus aria-hidden="true" />}{saving ? 'Creating…' : 'Create invitation'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
