import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, LoaderCircle } from 'lucide-react'
import { AccountingInvoicePicker } from './AccountingInvoicePicker'
import { AccountingLineFields } from './AccountingLineFields'
import { emptyLineDraft, lineDraftError, linePayload } from './accounting-line-draft'
import { useAccountingReferences } from '@/hooks/use-accounting-references'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { createAccountingEntry, getAccountingJournals } from '@/services/accounting'
import { ApiError } from '@/services/api'
import type { AccountingCandidate, AccountingEntryRecord, AccountingJournal } from '@/types/accounting'

function localToday() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}
function previewTotal(values: string[]) {
  if (values.some((value) => !/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim()))) return '—'
  const cents = values.reduce((total, value) => {
    const [integer, decimal = ''] = value.trim().split('.')
    return total + BigInt(integer) * 100n + BigInt(decimal.padEnd(2, '0'))
  }, 0n)
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}
export function AccountingEntryCreateSheet({ onClose, onCreated, onOpenExisting }: {
  onClose: () => void; onCreated: (record: AccountingEntryRecord) => void; onOpenExisting: (id: number) => void
}) {
  const references = useAccountingReferences()
  const [invoice, setInvoice] = useState<AccountingCandidate | null>(null)
  const [initialDate] = useState(localToday)
  const [date, setDate] = useState(initialDate)
  const [label, setLabel] = useState('')
  const [journalId, setJournalId] = useState('')
  const [lines, setLines] = useState(() => [{ key: crypto.randomUUID(), draft: { ...emptyLineDraft } }])
  const [journals, setJournals] = useState<AccountingJournal[] | null>(null)
  const [journalError, setJournalError] = useState(false)
  const [journalRetry, setJournalRetry] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const request = useRef<AbortController | null>(null)
  const dirty = Boolean(invoice || date !== initialDate || label || journalId || lines.length !== 1 || JSON.stringify(lines[0].draft) !== JSON.stringify(emptyLineDraft))
  useEffect(() => {
    const controller = new AbortController()
    getAccountingJournals(controller.signal).then((journals) => { if (!controller.signal.aborted) setJournals(journals.filter((item) => item.active)) }).catch(() => { if (!controller.signal.aborted) setJournalError(true) })
    return () => controller.abort()
  }, [journalRetry])
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty || saving) event.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])
  const valid = invoice && date && label.trim() && journalId && lines.length > 0 && lines.every((line) => !lineDraftError(line.draft))
  const existingId = error instanceof ApiError && error.code === 'ACCOUNTING_ENTRY_ALREADY_EXISTS' && error.details && typeof error.details === 'object' && 'accountingEntryId' in error.details
    && Number.isSafeInteger(error.details.accountingEntryId) && Number(error.details.accountingEntryId) > 0 ? Number(error.details.accountingEntryId) : null
  const close = () => { if (!saving && (!dirty || window.confirm('Discard this unsaved accounting entry?'))) onClose() }
  async function save() {
    if (!valid || !invoice || request.current || references.loading || references.error || !journals || journalError) return
    const controller = new AbortController()
    request.current = controller
    setSaving(true)
    setError(null)
    try {
      const created = await createAccountingEntry({ invoiceId: invoice.invoiceId, entryDate: date, journalId: Number(journalId), label: label.trim(), lines: lines.map((line) => linePayload(line.draft)) }, controller.signal)
      if (!controller.signal.aborted) onCreated(created)
    } catch (error) {
      if (!controller.signal.aborted) setError(error)
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false) }
    }
  }
  return <Sheet open onOpenChange={(open) => { if (!open) close() }}>
    <SheetContent className="w-full overflow-y-auto sm:max-w-3xl" onCloseAutoFocus={(event) => { const button = document.getElementById('create-entry'); if (button) { event.preventDefault(); button.focus() } }}>
      <SheetHeader className="pr-8 text-left"><SheetTitle>Create accounting entry</SheetTitle><SheetDescription>Record a supplier invoice with your own accounting lines. You can save an unbalanced proposal and complete it later.</SheetDescription></SheetHeader>
      <form className="mt-6 space-y-6" aria-label="Create accounting entry" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <AccountingInvoicePicker value={invoice} onChange={setInvoice} disabled={saving} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="entry-date">Entry date</Label><Input id="entry-date" type="date" required disabled={saving} value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="entry-journal">Journal</Label><Select value={journalId} onValueChange={setJournalId} disabled={saving || !journals}><SelectTrigger id="entry-journal" aria-label="Journal"><SelectValue placeholder="Select an active journal" /></SelectTrigger><SelectContent>{journals?.map((journal) => <SelectItem key={journal.accountingJournalId} value={String(journal.accountingJournalId)}>{journal.code} — {journal.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="entry-label">Entry label</Label><Input id="entry-label" required maxLength={255} disabled={saving} value={label} onChange={(event) => setLabel(event.target.value)} /></div>
        </div>
        {journalError ? <p role="alert" className="text-sm text-destructive">Unable to load journals. <Button type="button" variant="link" onClick={() => { setJournalError(false); setJournalRetry((value) => value + 1) }}>Retry journals</Button></p> : journals?.length === 0 ? <p role="alert">An active accounting journal must be configured before creating an entry.</p> : null}
        {references.loading ? <p role="status">Loading accounts and allocations…</p> : null}
        {references.error ? <p role="alert">Unable to load accounts and allocations. <Button type="button" variant="link" onClick={references.reload}>Retry references</Button></p> : null}
        <div className="space-y-4">{lines.map((line, index) => <fieldset key={line.key} className="space-y-4 rounded-lg border border-border p-4" disabled={saving}>
          <legend className="px-1 text-sm font-medium">Line {index + 1}</legend>
          <AccountingLineFields draft={line.draft} onChange={(draft) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, draft } : item))} accounts={references.accounts} classifications={references.classifications} disabled={saving || references.loading || Boolean(references.error)} />
          {lineDraftError(line.draft) ? <p className="text-xs text-muted-foreground">{lineDraftError(line.draft)}</p> : null}
          <Button type="button" variant="ghost" disabled={saving} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Trash2 aria-hidden="true" />Remove draft line {index + 1}</Button>
        </fieldset>)}</div>
        <Button type="button" variant="outline" disabled={saving} onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), draft: { ...emptyLineDraft } }])}><Plus aria-hidden="true" />Add draft line</Button>
        <section aria-label="Draft totals preview" className="rounded-lg border border-border bg-muted p-4 text-sm">
          <p className="font-medium">Draft preview · {invoice?.currencyCode ?? 'Currency not selected'}</p>
          <p>Debit: {previewTotal(lines.map((line) => line.draft.debitAmount))} · Credit: {previewTotal(lines.map((line) => line.draft.creditAmount))}</p>
          <p className="mt-1 text-xs text-muted-foreground">These amounts are not saved. The server confirms totals and export eligibility.</p>
        </section>
        {error ? <Alert variant="destructive"><AlertTitle>Unable to create accounting entry</AlertTitle><AlertDescription>
          <p>{error instanceof ApiError ? error.status === 403 ? 'You do not have permission to create accounting entries.' : error.message : 'Your draft is still available. Check your connection and try again.'}</p>
          {existingId ? <Button type="button" variant="outline" onClick={() => { if (window.confirm('Leave this draft and open the existing entry?')) onOpenExisting(existingId) }}>Open existing entry</Button> : null}
        </AlertDescription></Alert> : null}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={saving} onClick={close}>Cancel</Button><Button type="submit" disabled={!valid || saving || references.loading || Boolean(references.error) || !journals || journalError}>{saving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{saving ? 'Creating entry…' : 'Save entry'}</Button></div>
      </form>
    </SheetContent>
  </Sheet>
}
