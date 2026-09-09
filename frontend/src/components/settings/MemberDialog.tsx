import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'

import type { MemberAction } from '@/components/settings/MemberActionsMenu'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/services/api'
import { type MemberIdentity, updateMember, updateMemberRole, updateMemberStatus } from '@/services/members'
import { getRoles, isRoleCode } from '@/services/onboarding'
import type { OrganizationUser, ReferenceItem } from '@/types/onboarding'

const identityFields = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
] as const

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'LAST_ACTIVE_ADMINISTRATOR') return 'The last active administrator must keep their role and access. Close this dialog and reload the members.'
    if (error.code === 'SUBSCRIPTION_LIMIT_REACHED') return 'The active member limit for your plan has been reached. Deactivate another member or review your subscription.'
    if (error.code === 'USER_EMAIL_CONFLICT') return 'This email address is already in use.'
    if (error.status === 403) return 'You no longer have permission to manage members. Close this dialog and reload the members.'
    if (error.status === 404) return 'This member is no longer available in your organization. Close this dialog and reload the members.'
    if (error.status === 400) return 'The change was rejected. Check the values or reload the members if their role or status has changed.'
  }
  return 'The member could not be updated. Your changes are kept. Please try again.'
}

type MemberDialogProps = {
  action: MemberAction
  member: OrganizationUser
  isSelf: boolean
  onClose: () => void
  onSaved: (member: OrganizationUser) => void
  onRestoreFocus: () => void
}

export function MemberDialog({ action, member, isSelf, onClose, onSaved, onRestoreFocus }: MemberDialogProps) {
  const id = useId()
  const [identity, setIdentity] = useState<MemberIdentity>({ firstName: member.firstName, lastName: member.lastName, email: member.email })
  const [fieldError, setFieldError] = useState<{ key: keyof MemberIdentity, message: string } | null>(null)
  const [roleCode, setRoleCode] = useState(member.role.code)
  const [roles, setRoles] = useState<ReferenceItem[] | null>(null)
  const [rolesError, setRolesError] = useState(false)
  const [rolesRetry, setRolesRetry] = useState(0)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const request = useRef<AbortController | null>(null)
  const form = useRef<HTMLFormElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const denied = error instanceof ApiError && ([403, 404].includes(error.status) || error.code === 'LAST_ACTIVE_ADMINISTRATOR')
  const changes: Partial<MemberIdentity> = {}
  for (const { key } of identityFields) {
    const value = key === 'email' ? identity[key].trim().toLowerCase() : identity[key].trim()
    if (value !== member[key]) changes[key] = value
  }
  const canSave = action === 'edit' ? Object.keys(changes).length > 0 : action === 'role'
    ? Boolean(roles?.some(({ code }) => code === roleCode) && roleCode !== member.role.code) : true
  const title = action === 'edit' ? 'Edit member' : action === 'role' ? 'Change role' : member.active ? 'Deactivate member?' : 'Activate member?'
  const submitLabel = action === 'edit' ? 'Save changes' : action === 'role' ? 'Change role' : member.active ? 'Deactivate member' : 'Activate member'

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (fieldError && !saving) form.current?.querySelector<HTMLInputElement>(`[name="${fieldError.key}"]`)?.focus()
  }, [fieldError, saving])
  useEffect(() => {
    if (action !== 'role') return
    const controller = new AbortController()
    getRoles(controller.signal)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Invalid roles')
        if (!controller.signal.aborted) setRoles(data.filter(({ code }) => isRoleCode(code)))
      })
      .catch(() => { if (!controller.signal.aborted) setRolesError(true) })
    return () => controller.abort()
  }, [action, rolesRetry])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current || denied || !canSave) return
    if (action === 'edit') {
      const invalid = identityFields.find(({ key }) => !identity[key].trim() || (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity[key].trim())))
      if (invalid) {
        setFieldError({ key: invalid.key, message: invalid.key === 'email' ? 'Enter a valid email address.' : `Enter a ${invalid.label.toLowerCase()}.` })
        return
      }
    }
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    setFieldError(null)
    try {
      const updated = action === 'edit' ? await updateMember(member.id, changes, controller.signal)
        : action === 'role' ? await updateMemberRole(member.id, roleCode, controller.signal)
          : await updateMemberStatus(member.id, !member.active, controller.signal)
      if (!controller.signal.aborted) onSaved(updated)
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error)
        if (error instanceof ApiError && error.code === 'USER_EMAIL_CONFLICT') setFieldError({ key: 'email', message: 'This email address is already in use.' })
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Dialog onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg [&>button]:right-2 [&>button]:top-2 [&>button]:size-11" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }} onOpenAutoFocus={(event) => { event.preventDefault(); if (action === 'edit') form.current?.querySelector<HTMLInputElement>('input')?.focus(); else cancelButton.current?.focus() }}>
        <form aria-busy={saving} aria-label={title} className="space-y-5" noValidate onSubmit={(event) => void save(event)} ref={form}>
          <DialogHeader className="text-left">
            <DialogTitle className="pr-8">{title}</DialogTitle>
            <DialogDescription className="break-words">{action === 'edit' ? 'Update this member’s name and email address.' : action === 'role' ? `Update the role of ${member.firstName} ${member.lastName}. Access changes apply immediately.` : member.active ? `${member.firstName} ${member.lastName} will lose access to this workspace. Historical records are kept.` : `Restore workspace access for ${member.firstName} ${member.lastName}.`}</DialogDescription>
          </DialogHeader>
          {action === 'edit' ? identityFields.map(({ key, label }) => (
            <div className="space-y-2" key={key}>
              <Label htmlFor={`${id}-${key}`}>{label}</Label>
              <Input aria-describedby={fieldError?.key === key ? `${id}-field-error` : undefined} aria-invalid={fieldError?.key === key} autoComplete={key === 'email' ? 'email' : key === 'firstName' ? 'given-name' : 'family-name'} className="h-11" disabled={saving} id={`${id}-${key}`} name={key} onChange={(event) => { setIdentity({ ...identity, [key]: event.target.value }); setFieldError(null) }} required type={key === 'email' ? 'email' : 'text'} value={identity[key]} />
              {fieldError?.key === key ? <p className="text-xs text-destructive" id={`${id}-field-error`}>{fieldError.message}</p> : null}
            </div>
          )) : null}
          {action === 'role' ? rolesError ? <Alert variant="destructive"><AlertDescription className="space-y-3"><p>Unable to load available roles.</p><Button onClick={() => { setRolesError(false); setRoles(null); setRolesRetry((value) => value + 1) }} type="button" variant="outline">Retry roles</Button></AlertDescription></Alert> : roles === null ? <p aria-busy="true" role="status">Loading roles…</p> : !roles.length ? <p role="status">No roles are available. Contact an administrator.</p> : (
            <div className="space-y-2"><Label htmlFor={`${id}-role`}>Role</Label><Select disabled={saving} onValueChange={(value) => { if (isRoleCode(value)) setRoleCode(value) }} value={roleCode}><SelectTrigger className="h-11" id={`${id}-role`}><SelectValue /></SelectTrigger><SelectContent>{roles.map(({ code, label }) => <SelectItem className="min-h-11" key={code} value={code}>{label}</SelectItem>)}</SelectContent></Select></div>
          ) : null}
          {isSelf && action !== 'edit' ? <p className="rounded-md border bg-muted/40 p-3 text-sm">{action === 'role' ? 'You are changing your own role. You will lose access to member administration.' : 'You are deactivating your own account. You will be signed out.'}</p> : null}
          {error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{errorMessage(error)}</AlertDescription></Alert> : null}
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button className="h-11" disabled={saving} onClick={onClose} ref={cancelButton} type="button" variant="secondary">Cancel</Button>
            <Button className="h-11" disabled={saving || denied || !canSave} type="submit" variant={action === 'status' && member.active ? 'destructive' : 'default'}>{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{saving ? 'Saving…' : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
