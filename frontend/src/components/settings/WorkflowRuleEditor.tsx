import { type FormEvent, useEffect, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ApiError } from '@/services/api'
import { updateValidationPreferences } from '@/services/onboarding'
import type { ValidationPreferences, ValidationPreferencesUpdate } from '@/types/onboarding'

export type WorkflowAction = 'add' | 'edit' | 'disable'
type WorkflowRuleEditorProps = {
  action: WorkflowAction
  preferences: ValidationPreferences
  onClose: () => void
  onSaved: (preferences: ValidationPreferences) => void
  onReload: () => void
  onRestoreFocus: () => void
}

function saveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'The rule was rejected. Check the condition and amount, or reload the current workflow.'
    if (error.status === 403) return 'You no longer have permission to change the approval workflow.'
    if ([404, 405, 501].includes(error.status)) return 'Workflow changes are currently unavailable.'
    if (error.status === 409) return 'The workflow could not be saved because of a conflict. Reload its current settings before trying again.'
  }
  return 'The saved workflow could not be confirmed. Reload its current settings before trying again.'
}

export function WorkflowRuleEditor({ action, preferences, onClose, onSaved, onReload, onRestoreFocus }: WorkflowRuleEditorProps) {
  const [condition, setCondition] = useState<'amount' | 'all'>(preferences.validationRequired && preferences.validationThreshold === null ? 'all' : 'amount')
  const [amount, setAmount] = useState(preferences.validationThreshold === null ? '' : String(preferences.validationThreshold))
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const request = useRef<AbortController | null>(null)
  const amountInput = useRef<HTMLInputElement>(null)
  const conditionInput = useRef<HTMLButtonElement>(null)
  const cancelButton = useRef<HTMLButtonElement>(null)
  const title = action === 'disable' ? 'Disable approval?' : action === 'add' ? 'Add approval rule' : 'Edit approval rule'
  const blocked = Boolean(error) && !(error instanceof ApiError && error.status === 400)
  const normalized = amount.trim().replace(',', '.')
  const threshold = Number(normalized)
  const unchanged = action !== 'disable' && preferences.validationRequired && (
    condition === 'all' ? preferences.validationThreshold === null : threshold === preferences.validationThreshold
  )

  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => { if (fieldError && !saving) amountInput.current?.focus() }, [fieldError, saving])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (request.current || blocked || unchanged) return
    if (action !== 'disable' && condition === 'amount' && (
      !/^\d+(?:\.\d{1,2})?$/.test(normalized) || !Number.isFinite(threshold) || threshold <= 0 || threshold > 9999999999.99
    )) {
      setFieldError('Enter an amount greater than zero, up to 9,999,999,999.99, with at most two decimal places.')
      amountInput.current?.focus()
      return
    }
    const update: ValidationPreferencesUpdate = action === 'disable' ? { validationRequired: false }
      : condition === 'all' ? { validationRequired: true }
        : { validationRequired: true, validationThreshold: threshold }
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    setFieldError(null)
    try {
      const saved = await updateValidationPreferences(update, controller.signal)
      if (!controller.signal.aborted) onSaved(saved)
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error)
        if (error instanceof ApiError && error.status === 400 && error.message.startsWith('validationThreshold') && condition === 'amount' && action !== 'disable') {
          setFieldError('This amount was rejected. Check its value and precision.')
        }
      }
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }

  return (
    <Sheet onOpenChange={(open) => { if (!open && !request.current) onClose() }} open>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 p-0 sm:max-w-[480px] [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center" onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus() }} onOpenAutoFocus={(event) => { event.preventDefault(); (action === 'disable' ? cancelButton.current : conditionInput.current)?.focus() }}>
        <form aria-busy={saving} aria-label={title} className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => void save(event)}>
          <SheetHeader className="mx-6 shrink-0 border-b py-6 text-left"><SheetTitle className="pr-8 text-xl">{title}</SheetTitle><SheetDescription>{action === 'disable' ? 'Confirm the change to your organization’s approval policy.' : 'Define when invoices require approval.'}</SheetDescription></SheetHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            {action === 'disable' ? <div className="space-y-3 text-sm"><p>Invoices will skip the approval step when they are submitted, after the usual completeness checks.</p><p>The current threshold will be removed. Existing invoice statuses will stay unchanged.</p></div> : <>
              <section className="space-y-5" aria-labelledby="workflow-conditions">
                <div><h3 className="text-sm font-semibold" id="workflow-conditions">Conditions</h3><p className="mt-1 text-sm text-muted-foreground">Choose when this rule applies.</p></div>
                <div className="space-y-2"><Label htmlFor="workflow-condition">Condition</Label><Select disabled={saving} onValueChange={(value) => { if (value === 'all' || value === 'amount') { setCondition(value); setFieldError(null) } }} value={condition}><SelectTrigger className="h-11" id="workflow-condition" ref={conditionInput}><SelectValue /></SelectTrigger><SelectContent><SelectItem className="min-h-11" value="amount">Invoice amount</SelectItem><SelectItem className="min-h-11" value="all">All invoices</SelectItem></SelectContent></Select></div>
                {condition === 'amount' ? <div className="space-y-3"><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><p className="text-sm font-medium">Operator</p><p className="flex min-h-11 items-center rounded-md border border-input px-3 py-1.5 text-xs">Greater than or equal to (≥)</p></div><div className="space-y-2"><Label htmlFor="workflow-amount">Amount (incl. tax)</Label><Input aria-describedby="workflow-amount-help" aria-invalid={Boolean(fieldError)} className="h-11" disabled={saving} id="workflow-amount" inputMode="decimal" onChange={(event) => { setAmount(event.target.value); setFieldError(null) }} ref={amountInput} value={amount} /></div></div><p className={fieldError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'} id="workflow-amount-help">{fieldError ?? 'A positive amount with at most two decimal places. The same numeric threshold applies to invoice totals; currencies are not converted.'}</p></div> : <p className="rounded-lg bg-muted p-3 text-sm">Every submitted invoice requires approval, regardless of its amount.</p>}
                <div className="space-y-1"><h4 className="text-sm font-medium">Project / Site</h4><p className="text-sm text-muted-foreground">All projects and sites in this organization.</p></div>
              </section>
              <section className="space-y-3 border-t pt-5" aria-labelledby="workflow-route"><h3 className="text-sm font-semibold" id="workflow-route">Approval route</h3><p className="rounded-lg bg-muted p-3 text-sm">One approval step, handled by any member with validation access.</p><p className="text-xs text-muted-foreground">Named approvers and sequential steps are not available yet.</p></section>
              <section className="space-y-2 border-t pt-5" aria-labelledby="workflow-fallback"><h3 className="text-sm font-semibold" id="workflow-fallback">Default behavior</h3><p className="text-sm text-muted-foreground">{condition === 'amount' ? 'Invoices below the threshold skip approval when submitted, after completeness checks. An invoice exactly at the threshold requires approval.' : 'All submitted invoices require approval. There is no amount-based exemption.'}</p></section>
            </>}
            {error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription className="space-y-3"><p>{saveErrorMessage(error)}</p><Button onClick={onReload} type="button" variant="outline">Reload workflow</Button></AlertDescription></Alert> : null}
          </div>
          <footer className="flex shrink-0 justify-end gap-2 border-t bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"><Button className="h-11" disabled={saving} onClick={onClose} ref={cancelButton} type="button" variant="secondary">Cancel</Button><Button className="h-11" disabled={saving || blocked || unchanged} type="submit" variant={action === 'disable' ? 'destructive' : 'default'}>{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{saving ? 'Saving…' : action === 'disable' ? 'Disable approval' : 'Save rule'}</Button></footer>
        </form>
      </SheetContent>
    </Sheet>
  )
}
