import { type FormEvent, useEffect, useId, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, LoaderCircle, Scale } from 'lucide-react'
import { Link } from 'react-router-dom'

import { OrganizationCurrencyField } from '@/components/settings/OrganizationCurrencyField'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ApiError } from '@/services/api'
import { getCurrentOrganization, updateCurrentOrganization } from '@/services/organization'
import type { Organization } from '@/types/organization'

function UnavailableField({ label }: { label: string }) {
  const id = useId()
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select disabled><SelectTrigger className="h-11 md:h-9" id={id}><SelectValue placeholder="Not available" /></SelectTrigger></Select>
    </div>
  )
}

type AccountingSettingsFormProps = {
  canManage: boolean
  onReload: () => void
  onSaved: (organization: Organization) => void
  organization: Organization
}

export function AccountingSettingsForm({ canManage, onReload, onSaved, organization }: AccountingSettingsFormProps) {
  const id = useId()
  const form = useRef<HTMLFormElement>(null)
  const request = useRef<AbortController | null>(null)
  const [currency, setCurrency] = useState(organization.defaultCurrencyCode ?? '')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const blocked = Boolean(error) && !(error instanceof ApiError && error.status === 400)
  const changed = currency !== (organization.defaultCurrencyCode ?? '')

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (fieldError && !saving) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }, [fieldError, saving])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || request.current || !changed || blocked) return
    if (!/^[A-Z]{3}$/.test(currency)) {
      setFieldError('Choose a currency from the available list.')
      return
    }
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setSaved(false)
    setError(null)
    setFieldError(undefined)
    let updateConfirmed = false
    try {
      const updated = await updateCurrentOrganization({ defaultCurrencyCode: currency }, controller.signal)
      if (controller.signal.aborted) return
      if (!updated || updated.organizationId !== organization.organizationId || updated.defaultCurrencyCode !== currency) throw new Error('Unexpected currency update')
      updateConfirmed = true
      const reloaded = await getCurrentOrganization(controller.signal)
      if (controller.signal.aborted) return
      if (!reloaded || reloaded.organizationId !== organization.organizationId || reloaded.defaultCurrencyCode !== currency) throw new Error('Currency update could not be reloaded')
      onSaved(reloaded)
      setSaved(true)
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(updateConfirmed && error instanceof ApiError && error.status === 400 ? new Error('Unable to reload the saved currency') : error)
        if (!updateConfirmed && error instanceof ApiError && error.status === 400) setFieldError('This currency was rejected. Choose a recognized currency or reload the saved settings.')
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <form aria-busy={saving} aria-label="Accounting preferences" className="space-y-6" noValidate onSubmit={(event) => void save(event)} ref={form}>
      {!canManage ? <p className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">Only administrators can change accounting preferences. You have read-only access.</p> : null}
      <section aria-labelledby={`${id}-fiscal`} className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-[-0.25px]" id={`${id}-fiscal`}>Fiscal configuration</h3>
          <p className="text-sm text-muted-foreground">Set the default currency for new invoices. Existing invoices keep their currency.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <OrganizationCurrencyField
            disabled={!canManage || saving || blocked}
            error={fieldError}
            id={`${id}-currency`}
            onChange={(value) => { setCurrency(value); setFieldError(undefined); setError(null); setSaved(false) }}
            unavailableMessage="Currencies are unavailable. Retry to change the default currency."
            value={currency}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2"><UnavailableField label="Fiscal year" /><UnavailableField label="Default journal" /></div>
        <p className="text-xs text-muted-foreground">Fiscal year and default journal preferences are not configurable yet.</p>
      </section>
      <section aria-labelledby={`${id}-accounts`} className="space-y-4 border-t pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1"><h3 className="text-xl font-semibold tracking-[-0.25px]" id={`${id}-accounts`}>Default accounts</h3><p className="text-sm text-muted-foreground">Account assignments are configured in accounting rules.</p></div>
          <Button asChild className="h-11 shrink-0 self-start px-0 sm:px-4" variant="link"><Link to="/accounting/accounts">Chart of accounts</Link></Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2"><UnavailableField label="Supplier account" /><UnavailableField label="VAT account" /><UnavailableField label="Default expense account" /></div>
        <p className="text-xs text-muted-foreground">Organization-wide default accounts are not available here. Review the applicable accounting rule to change its accounts.</p>
      </section>
      <section aria-labelledby={`${id}-entries`} className="space-y-4 border-t pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1"><h3 className="text-xl font-semibold tracking-[-0.25px]" id={`${id}-entries`}>Accounting entries</h3><p className="text-sm text-muted-foreground">Numbering and date preferences are not configurable yet.</p></div>
          <Button asChild className="h-11 shrink-0 self-start px-0 sm:px-4" variant="link"><Link to="/accounting/rules">Accounting rules</Link></Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2"><UnavailableField label="Entry numbering" /><UnavailableField label="Default entry date behavior" /></div>
        <div className="space-y-2"><h4 className="text-sm font-medium">Generated entry validation</h4><div className="flex items-start gap-3 rounded-lg border p-4"><Scale aria-hidden="true" className="size-5 shrink-0 text-primary" /><p className="text-sm">Entries must remain balanced before they can be exported. Review actual amounts in Accounting.</p></div></div>
      </section>
      <section aria-labelledby={`${id}-export`} className="space-y-4 border-t pt-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1"><h3 className="text-xl font-semibold tracking-[-0.25px]" id={`${id}-export`}>Export</h3><p className="text-sm text-muted-foreground">Choose the format when preparing an export.</p></div>
          <Button asChild className="h-11 shrink-0 self-start px-0 sm:px-4" variant="link"><Link to="/exports">Export center</Link></Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2"><UnavailableField label="Default export format" /><UnavailableField label="CSV template" /></div>
        <p className="text-xs text-muted-foreground">A saved default format and custom CSV templates are not available yet.</p>
      </section>
      {error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription className="space-y-3">
        <p>{error instanceof ApiError && error.status === 403 ? 'You no longer have permission to change accounting preferences.'
          : error instanceof ApiError && error.status === 400 ? 'The currency was rejected. Review your choice or reload the current settings.'
            : 'The saved currency could not be confirmed. Reload settings to check its current value before trying again.'}</p>
        <Button onClick={onReload} type="button" variant="outline">Reload settings</Button>
      </AlertDescription></Alert> : null}
      {saved ? <div className="flex items-center gap-2 rounded-lg bg-success-muted p-3 text-sm text-success" role="status"><CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />Currency saved and reloaded.</div> : null}
      <div className="flex flex-col gap-2 border-t pt-6 sm:flex-row sm:justify-end">
        <Button className="h-11 sm:mr-auto" disabled={saving} onClick={onReload} type="button" variant="outline">Reload preferences</Button>
        {canManage ? <>
          <Button className="h-11" disabled={!changed || saving || blocked} onClick={() => { setCurrency(organization.defaultCurrencyCode ?? ''); setFieldError(undefined); setError(null); setSaved(false) }} type="button" variant="secondary">Cancel</Button>
          <Button className="h-11" disabled={!changed || saving || blocked} type="submit">{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{saving ? 'Saving…' : 'Save changes'}</Button>
        </> : null}
      </div>
    </form>
  )
}
