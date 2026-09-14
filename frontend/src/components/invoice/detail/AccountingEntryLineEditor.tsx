import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LoaderCircle } from 'lucide-react'
import { AccountingLineFields } from '@/components/accounting/AccountingLineFields'
import { lineDraft, lineDraftError, linePayload } from '@/components/accounting/accounting-line-draft'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAccountingReferences } from '@/hooks/use-accounting-references'
import { ApiError } from '@/services/api'
import { mutateAccountingLine } from '@/services/accounting'
import type { AccountingEntry, AccountingEntryLine } from '@/types/invoice'

export function AccountingEntryLineEditor({ entryId, version, line, onCancel, onEntryUpdated, onReload, onCloseGuardChange }: {
  onCloseGuardChange?: (guard: (() => boolean) | null) => void
  entryId: number; version?: number; line?: AccountingEntryLine
  onCancel: () => void; onEntryUpdated: (entry: AccountingEntry) => Promise<void>; onReload: () => Promise<void>
}) {
  const references = useAccountingReferences()
  const [draft, setDraft] = useState(() => lineDraft(line))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  const retry = useRef<{ payload: string; key: string } | null>(null)
  const effectiveDraft = { ...draft, accountId: draft.accountId || String(references.accounts.find((account) => account.accountNumber === line?.accountNumber)?.accountId ?? '') }
  const validation = lineDraftError(effectiveDraft)
  const dirty = JSON.stringify(draft) !== JSON.stringify(lineDraft(line))
  const blocked = error instanceof ApiError && [403, 404, 409].includes(error.status)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    onCloseGuardChange?.(() => !saving && (!dirty || window.confirm('Discard unsaved changes?')))
    return () => onCloseGuardChange?.(null)
  }, [dirty, saving, onCloseGuardChange])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || saving) event.preventDefault() }
    const guardNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest('a[href], [role="tab"]')) return
      if (saving || dirty && !window.confirm('Discard unsaved changes?')) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    document.addEventListener('click', guardNavigation, true)
    window.addEventListener('beforeunload', warn)
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', guardNavigation, true) }
  }, [dirty, saving])

  async function save() {
    if (request.current || validation || references.loading || references.error || blocked || version === undefined) return
    const payload = linePayload(effectiveDraft)
    const original = linePayload({ ...lineDraft(line), accountId: effectiveDraft.accountId })
    const body = line ? Object.fromEntries(Object.entries(payload).filter(([key, value]) => {
      if (key === 'accountId') return line.accountId ? value !== line.accountId : !references.accounts.some((account) => account.accountId === value && account.accountNumber === line.accountNumber)
      const previous = original[key as keyof typeof original]
      return ['debitAmount', 'creditAmount', 'vatRate'].includes(key) && value !== null && previous !== null
        ? Number(value) !== Number(previous) : value !== previous
    })) : payload
    const fingerprint = JSON.stringify([version, body])
    if (retry.current?.payload !== fingerprint) retry.current = { payload: fingerprint, key: crypto.randomUUID() }
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    try {
      const saved = await mutateAccountingLine(entryId, line?.accountingEntryLineId ?? null, line ? 'PATCH' : 'POST', body, version, retry.current.key, controller.signal)
      if (!controller.signal.aborted) {
        await onEntryUpdated(saved)
        toast.success(line ? 'Accounting line saved' : 'Accounting line added', {
          description: line ? `Line ${line.lineNumber} was updated and the balance was recalculated.` : 'The entry was saved and its checks were recalculated.',
        })
      }
    } catch (error) {
      if (!controller.signal.aborted) setError(error)
    } finally {
      if (!controller.signal.aborted) { setSaving(false); request.current = null }
    }
  }
  return <div className="rounded-lg border border-border bg-info-muted/30 p-4">
    <form aria-label={line ? 'Edit accounting line' : 'Add accounting line'} className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save() }}>
      <AccountingLineFields draft={effectiveDraft} onChange={setDraft} accounts={references.accounts} classifications={references.classifications} disabled={saving || references.loading || Boolean(references.error) || blocked} />
      {line ? <p className="text-xs text-muted-foreground">Current: {line.accountNumber} — {line.accountLabel}</p> : null}
      {references.loading ? <p role="status">Loading accounts and allocations…</p> : null}
      {references.error ? <div role="alert">Unable to load accounts and allocations. <Button onClick={references.reload} variant="link" type="button">Try again</Button></div> : null}
      {validation ? <p role="status" className="text-sm text-destructive">{validation}</p> : null}
      {version === undefined ? <p role="alert">Reload the entry to obtain its current version.</p> : null}
      {error ? <Alert variant="destructive"><AlertTitle>Unable to save accounting line</AlertTitle>
        <AlertDescription>{error instanceof ApiError ? error.message : 'Your changes are still available. Please try again.'}
          {blocked ? <Button onClick={() => { if (!dirty || window.confirm('Discard unsaved changes and reload the entry?')) void onReload() }} variant="outline" type="button">Reload entry</Button> : null}
        </AlertDescription></Alert> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={saving || !dirty || Boolean(validation) || references.loading || Boolean(references.error) || blocked || version === undefined} type="submit">
          {saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}Save
        </Button>
        <Button disabled={saving} onClick={() => { if (!dirty || window.confirm('Discard unsaved changes?')) onCancel() }} variant="outline" type="button">Cancel</Button>
      </div>
    </form>
  </div>
}
