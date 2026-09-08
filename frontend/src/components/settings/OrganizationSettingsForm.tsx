import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle } from 'lucide-react'

import { OrganizationCurrencyField } from '@/components/settings/OrganizationCurrencyField'
import { organizationChanges, organizationFields, organizationSaveErrors, organizationValues, validateOrganizationChanges } from '@/components/settings/organization-settings-utils'
import type { OrganizationErrors, OrganizationValues } from '@/components/settings/organization-settings-utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ApiError } from '@/services/api'
import { updateCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'

type OrganizationSettingsFormProps = {
  canManage: boolean
  onReload: () => void
  onSaved: (organization: Organization) => void
  organization: Organization
}

export function OrganizationSettingsForm({ canManage, onReload, onSaved, organization }: OrganizationSettingsFormProps) {
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const request = useRef<AbortController | null>(null)
  const [values, setValues] = useState(() => organizationValues(organization))
  const [errors, setErrors] = useState<OrganizationErrors>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [denied, setDenied] = useState(false)
  const readOnly = !canManage || denied
  const changes = organizationChanges(organization, values)
  const changed = Object.keys(changes).length > 0

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (!saving) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [errors, saving])

  function updateField(key: keyof OrganizationValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }))
    setSaved(false)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (readOnly || request.current || !changed) return
    const validationErrors = validateOrganizationChanges(changes)
    setErrors(validationErrors)
    setSaved(false)
    if (Object.keys(validationErrors).length) return

    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    try {
      const updated = await updateCurrentOrganization(changes, controller.signal)
      if (controller.signal.aborted) return
      if (!updated || updated.organizationId !== organization.organizationId) throw new Error('Unexpected organization')
      setValues(organizationValues(updated))
      onSaved(updated)
      setSaved(true)
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrors(organizationSaveErrors(error))
        if (error instanceof ApiError && error.status === 403) setDenied(true)
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <form aria-busy={saving} aria-label="General organization settings" className="space-y-4" noValidate onSubmit={(event) => void save(event)} ref={form}>
      {!canManage ? <Alert><AlertDescription>Only administrators can update these settings. You have read-only access.</AlertDescription></Alert> : null}
      <section aria-labelledby={`${id}-organization`} className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-[-0.25px]" id={`${id}-organization`}>Organization</h3>
          <p className="text-xs text-muted-foreground">Manage legal and contact information for your organization.</p>
        </div>
        <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
          {organizationFields.map(({ key, label, hint, required, type, autoComplete }) => (
            <div className="min-w-0 space-y-1.5" key={key}>
              <Label className="text-xs tracking-[0.1px]" htmlFor={`${id}-${key}`}>{label}</Label>
              <Input
                aria-describedby={`${id}-${key}-description`}
                aria-invalid={Boolean(errors[key])}
                autoComplete={autoComplete}
                className="h-11 md:h-9"
                disabled={saving}
                id={`${id}-${key}`}
                inputMode={key === 'siret' ? 'numeric' : undefined}
                onChange={(event) => updateField(key, event.target.value)}
                readOnly={readOnly}
                required={required}
                type={type}
                value={values[key]}
              />
              <p className={errors[key] ? 'text-xs text-destructive-text' : 'text-xs text-muted-foreground'} id={`${id}-${key}-description`}>{errors[key] ?? hint}</p>
            </div>
          ))}
        </div>
      </section>
      <Separator />
      <section aria-labelledby={`${id}-localization`} className="space-y-3">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-[-0.25px]" id={`${id}-localization`}>Localization</h3>
          <p className="text-xs text-muted-foreground">Set the default currency used for new invoices.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <OrganizationCurrencyField disabled={saving || readOnly} error={errors.defaultCurrencyCode} id={`${id}-defaultCurrencyCode`} onChange={(value) => updateField('defaultCurrencyCode', value)} value={values.defaultCurrencyCode} />
        </div>
      </section>
      {errors.form ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription className="space-y-2">
            <p>{errors.form}</p>
            <Button onClick={onReload} type="button" variant="outline">Reload settings</Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {saved ? (
        <div className="flex items-center gap-2 rounded-md bg-success-muted p-3 text-sm text-success" role="status">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />Changes saved.
        </div>
      ) : null}
      {canManage ? (
        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button className="h-11 sm:h-10" disabled={!changed || saving || denied} onClick={() => { setValues(organizationValues(organization)); setErrors({}); setSaved(false) }} type="button" variant="outline">Cancel</Button>
          <Button className="h-11 sm:h-10" disabled={!changed || saving || denied} type="submit">
            {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      ) : null}
    </form>
  )
}
